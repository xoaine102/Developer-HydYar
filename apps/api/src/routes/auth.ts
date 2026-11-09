// Auth routes: register / login / logout / refresh (mounted at /api/auth),
// plus GET/PATCH /me (exported separately and mounted at /api/me).
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { ApiError, asyncHandler } from "../lib/errors.js";
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  issueRefreshToken,
  refreshCookieOptions,
  readRefreshToken,
  resolveRefreshToken,
  requireAuth,
  roleForNewUser,
  toUserDTO,
} from "../lib/auth.js";
import { config } from "../config.js";

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email("Valid email required"),
  username: z
    .string()
    .min(2, "Username must be at least 2 characters")
    .max(30, "Username max 30 characters")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Username may contain letters, digits, _ . -"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);
    const email = body.email.toLowerCase();
    const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { username: body.username }] } });
    if (existing) {
      throw new ApiError(409, "CONFLICT", existing.email === email ? "Email already registered" : "Username already taken");
    }
    const role = await roleForNewUser(email);
    const user = await prisma.user.create({
      data: { email, username: body.username, passwordHash: await hashPassword(body.password), role },
    });
    const [accessToken, refreshToken] = await Promise.all([signAccessToken(user), issueRefreshToken(user.id)]);
    res.cookie(config.refreshCookieName, refreshToken, refreshCookieOptions());
    return res.status(201).json({ user: toUserDTO(user), accessToken });
  }),
);

const loginSchema = z.object({
  email: z.string().min(1, "Email or username required"),
  password: z.string().min(1, "Password required"),
});

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const ident = body.email.trim();
    const user = await prisma.user.findFirst({
      where: ident.includes("@") ? { email: ident.toLowerCase() } : { username: ident },
    });
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email/username or password");
    }
    const [accessToken, refreshToken] = await Promise.all([signAccessToken(user), issueRefreshToken(user.id)]);
    res.cookie(config.refreshCookieName, refreshToken, refreshCookieOptions());
    return res.json({ user: toUserDTO(user), accessToken });
  }),
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const raw = readRefreshToken(req);
    if (raw) {
      // Best-effort revocation; compute hash without verifying signature.
      const { createHash } = await import("node:crypto");
      const tokenHash = createHash("sha256").update(raw).digest("hex");
      await prisma.refreshToken.updateMany({ where: { tokenHash }, data: { revoked: true } }).catch(() => undefined);
    }
    res.clearCookie(config.refreshCookieName, { ...refreshCookieOptions(), maxAge: 0 });
    return res.json({ ok: true });
  }),
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const raw = readRefreshToken(req);
    if (!raw) throw ApiError.unauthorized("Missing refresh token cookie");
    const userId = await resolveRefreshToken(raw);
    if (!userId) {
      res.clearCookie(config.refreshCookieName, { ...refreshCookieOptions(), maxAge: 0 });
      throw ApiError.unauthorized("Invalid or expired refresh token");
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw ApiError.unauthorized("User no longer exists");
    // Rotate: revoke the old token, issue a fresh pair.
    const { createHash } = await import("node:crypto");
    const oldHash = createHash("sha256").update(raw).digest("hex");
    await prisma.refreshToken.updateMany({ where: { tokenHash: oldHash }, data: { revoked: true } }).catch(() => undefined);
    const [accessToken, refreshToken] = await Promise.all([signAccessToken(user), issueRefreshToken(user.id)]);
    res.cookie(config.refreshCookieName, refreshToken, refreshCookieOptions());
    return res.json({ accessToken, user: toUserDTO(user) });
  }),
);

// --- /me (mounted at /api/me) ---
export const meRouter = Router();

meRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
    if (!user) throw ApiError.unauthorized("User no longer exists");
    return res.json(toUserDTO(user));
  }),
);

const patchMeSchema = z
  .object({
    bio: z.string().max(500).nullable().optional(),
    avatarUrl: z.string().url("avatarUrl must be a valid URL").or(z.literal("")).nullable().optional(),
    username: z
      .string()
      .min(2)
      .max(30)
      .regex(/^[a-zA-Z0-9_.-]+$/)
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Provide at least one field to update" });

meRouter.patch(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = patchMeSchema.parse(req.body);
    if (body.username) {
      const taken = await prisma.user.findFirst({ where: { username: body.username, NOT: { id: req.user!.sub } } });
      if (taken) throw new ApiError(409, "CONFLICT", "Username already taken");
    }
    const data: { bio?: string | null; avatarUrl?: string | null; username?: string } = {};
    if (body.bio !== undefined) data.bio = body.bio;
    if (body.avatarUrl !== undefined) data.avatarUrl = body.avatarUrl === "" ? null : body.avatarUrl;
    if (body.username) data.username = body.username;
    const user = await prisma.user.update({ where: { id: req.user!.sub }, data });
    return res.json(toUserDTO(user));
  }),
);
