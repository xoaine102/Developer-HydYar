// Central environment configuration. All defaults match .env.example.
import process from "node:process";

function int(name: string, def: number): number {
  const raw = process.env[name];
  if (!raw) return def;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}

function str(name: string, def: string): string {
  const v = process.env[name];
  return v === undefined || v === "" ? def : v;
}

/** Convert a TTL string like "15m" / "7d" / "12h" / "30s" to milliseconds. */
export function ttlToMs(ttl: string): number {
  const m = /^(\d+)\s*([smhd])$/.exec(ttl.trim());
  if (!m) return 7 * 24 * 60 * 60 * 1000; // default 7d
  const n = Number.parseInt(m[1], 10);
  const unit = m[2];
  const mult = unit === "s" ? 1000 : unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000;
  return n * mult;
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProd: process.env.NODE_ENV === "production",
  port: int("PORT", 4000),
  webOrigin: str("WEB_ORIGIN", "http://localhost:5173"),
  jwtAccessSecret: str("JWT_ACCESS_SECRET", "dev-access-secret-change-me-please-min-32-chars-long"),
  jwtRefreshSecret: str("JWT_REFRESH_SECRET", "dev-refresh-secret-change-me-please-min-32-chars-long"),
  accessTokenTtl: str("ACCESS_TOKEN_TTL", "15m"),
  refreshTokenTtl: str("REFRESH_TOKEN_TTL", "7d"),
  bootstrapAdminEmail: str("BOOTSTRAP_ADMIN_EMAIL", "").trim().toLowerCase(),
  refreshCookieName: "hydyar_refresh",
  exec: {
    maxCpuMs: int("EXEC_MAX_CPU_MS", 8000),
    maxMemMb: int("EXEC_MAX_MEM_MB", 256),
    maxOutputKb: int("EXEC_MAX_OUTPUT_KB", 64),
    queueMax: int("EXEC_QUEUE_MAX", 20),
    concurrency: int("EXEC_CONCURRENCY", 2),
  },
} as const;

if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
  console.warn(
    "[config] JWT_ACCESS_SECRET / JWT_REFRESH_SECRET not set — using insecure dev defaults. " +
      "Set strong secrets in production.",
  );
}
