// Developer HydYar — API server entrypoint.
// Express + Socket.IO on a single HTTP server (one Render service).
// In production the same process also serves ../web/dist with an SPA fallback.
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { errorHandler, notFoundHandler } from "./lib/errors.js";
import { attachSocket } from "./lib/socket.js";
import { authRouter, meRouter } from "./routes/auth.js";
import { docsRouter } from "./routes/docs.js";
import { searchRouter } from "./routes/search.js";
import { projectsRouter } from "./routes/projects.js";
import { executeRouter } from "./routes/execute.js";
import { forumRouter } from "./routes/forum.js";
import { suggestionsRouter } from "./routes/suggestions.js";
import { chatRouter } from "./routes/chat.js";
import { adminRouter } from "./routes/admin.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, ".."); // apps/api (src is one level down at runtime: dist/)
const webDist = path.resolve(apiRoot, "..", "web", "dist"); // apps/web/dist

const app = express();
app.set("trust proxy", 1); // Render / reverse proxy

// --- CORS: WEB_ORIGIN may be a single origin or comma-separated list ---
const allowedOrigins = config.webOrigin
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  }),
);

app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));

// --- Rate limits (window = 1 minute) ---
const limitJson = (code: string, message: string) => ({ error: { code, message } });
const authLimiter = rateLimit({
  windowMs: 60_000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: limitJson("RATE_LIMITED", "Too many auth attempts, try again in a minute"),
});
const executeLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: limitJson("RATE_LIMITED", "Too many execution requests, slow down"),
});
const generalLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: limitJson("RATE_LIMITED", "Request limit reached, slow down"),
});

app.use("/api", generalLimiter);

// Health check (for Render / load balancer)
app.get("/api/health", (_req, res) => res.json({ ok: true, uptime: process.uptime() }));

// --- API routes ---
app.use("/api/auth", authLimiter, authRouter);
app.use("/api/me", meRouter);
app.use("/api/docs", docsRouter);
app.use("/api/search", searchRouter);
app.use("/api/projects", projectsRouter);
// Rate-limit only execution submissions (POST); poll GETs are cheap and must stay responsive.
app.use("/api/execute", (req, res, next) => (req.method === "POST" ? executeLimiter(req, res, next) : next()), executeRouter);
app.use("/api", forumRouter); // exposes /posts, /comments/:id, /posts/:id/...
app.use("/api/doc-suggestions", suggestionsRouter);
app.use("/api/chat", chatRouter);
app.use("/api/admin", adminRouter);

// --- Static frontend (single Render service) + SPA fallback ---
if (existsSync(webDist)) {
  app.use(express.static(webDist, { maxAge: "1h", index: false }));
  const indexFile = path.join(webDist, "index.html");
  app.use((req, res, next) => {
    if ((req.method !== "GET" && req.method !== "HEAD") || req.path.startsWith("/api")) return next();
    if (!existsSync(indexFile)) return next();
    return res.sendFile(indexFile);
  });
} else if (config.isProd) {
  console.warn(`[index] web dist not found at ${webDist}; serving API only. Run the frontend build first.`);
}

// 404 for anything else (including unmatched /api/*), then the error handler.
app.use(notFoundHandler);
app.use(errorHandler);

const httpServer = createServer(app);
attachSocket(httpServer); // Socket.IO at /socket.io, token-authenticated handshake

httpServer.listen(config.port, () => {
  console.log(`[hydyar-api] listening on http://localhost:${config.port} (NODE_ENV=${config.nodeEnv})`);
  if (existsSync(webDist)) console.log(`[hydyar-api] also serving frontend from ${webDist}`);
});

const shutdown = (signal: string) => {
  console.log(`[hydyar-api] ${signal} received, shutting down`);
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref?.();
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
