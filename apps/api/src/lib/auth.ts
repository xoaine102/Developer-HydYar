// Authentication: password hashing, JWT access+refresh, httpOnly refresh cookie,
// and requireAuth / requireAdmin middleware. First registered user (or the email
// matching BOOTSTRAP_ADMIN_EMAIL) becomes ADMIN.
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import crypto from "node:crypto";
import type { CookieOptions, Request, RequestHandler } from "express";
import type { User, Role } from "@prisma/client";
import type { UserDTO } from "@hydyar/shared";
import { prisma } from "./prisma.js";
import { config, ttlToMs } from "../config.js";
import { ApiError } from "./errors.js";

export interface AuthUser {
  sub: string;
  role: Role;
  username: string;
}

// Augment Express Request so req.user is typed across routes.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const hashPassword = (password: string): Promise<string> => bcrypt.hash(password, 10);
export const verifyPassword = (password: string, hash: string): Promise<boolean> => bcrypt.compare(password, hash);

export function toUserDTO(u: User): UserDTO {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    role: u.role,
    bio: u.bio,
    avatarUrl: u.avatarUrl,
    createdAt: u.createdAt.toISOString(),
  };
}

export function signAccessToken(user: { id: string; role: Role; username: string }): string {
  return jwt.sign({ sub: user.id, role: user.role, username: user.username }, config.jwtAccessSecret, {
    expiresIn: config.accessTokenTtl as SignOptions["expiresIn"],
  });
}

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/** Issue a refresh JWT, persist its hash, and return the raw token (sent only via httpOnly cookie). */
export async function issueRefreshToken(userId: string): Promise<string> {
  const token = jwt.sign(
    { sub: userId, type: "refresh", jti: crypto.randomUUID() },
    config.jwtRefreshSecret,
    { expiresIn: config.refreshTokenTtl as SignOptions["expiresIn"] },
  );
  const decoded = jwt.decode(token) as { exp: number } | null;
  const expiresAt = decoded ? new Date(decoded.exp * 1000) : new Date(Date.now() + ttlToMs(config.refreshTokenTtl));
  await prisma.refreshToken.create({ data: { userId, tokenHash: sha256(token), expiresAt } });
  return token;
}

export function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    // Secure cookies are still sent to http://localhost (browser exemption);
    // production is HTTPS behind Render. SameSite=None required for cross-origin
    // dev (api:4000 / web:5173); lax is enough once both are same-origin in prod.
    secure: true,
    sameSite: config.isProd ? "lax" : "none",
    path: "/",
    maxAge: ttlToMs(config.refreshTokenTtl),
  };
}

/** Read the refresh token from the httpOnly cookie, or from the x-refresh-token header as a dev fallback. */
export function readRefreshToken(req: Request): string | null {
  const fromCookie = req.cookies?.[config.refreshCookieName];
  if (typeof fromCookie === "string" && fromCookie) return fromCookie;
  const header = req.headers["x-refresh-token"];
  if (Array.isArray(header)) return typeof header[0] === "string" ? header[0] : null;
  return typeof header === "string" ? header : null;
}

/** Verify a refresh token against the DB (hash match, not revoked, not expired). Returns userId or null. */
export async function resolveRefreshToken(rawToken: string): Promise<string | null> {
  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(rawToken, config.jwtRefreshSecret) as jwt.JwtPayload;
  } catch {
    return null;
  }
  if (payload.type !== "refresh" || !payload.sub) return null;
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(rawToken) } });
  if (!record || record.revoked || record.expiresAt < new Date()) return null;
  return record.userId;
}

function bearerFrom(req: { headers: { authorization?: string } }): string | null {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return null;
  return h.slice(7).trim();
}

/** Require a valid access token; attaches req.user. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = bearerFrom(req);
  if (!token) return next(ApiError.unauthorized("Missing Bearer access token"));
  try {
    const payload = jwt.verify(token, config.jwtAccessSecret) as jwt.JwtPayload & AuthUser;
    if (!payload.sub) return next(ApiError.unauthorized("Invalid token payload"));
    req.user = { sub: payload.sub, role: payload.role, username: payload.username };
    return next();
  } catch {
    return next(ApiError.unauthorized("Invalid or expired access token"));
  }
};

/** Attach req.user when a valid token is present, but never reject (for public GETs that personalize). */
export const optionalAuth: RequestHandler = (req, _res, next) => {
  const token = bearerFrom(req);
  if (token) {
    try {
      const payload = jwt.verify(token, config.jwtAccessSecret) as jwt.JwtPayload & AuthUser;
      if (payload.sub) req.user = { sub: payload.sub, role: payload.role, username: payload.username };
    } catch {
      /* ignore — treat as anonymous */
    }
  }
  next();
};

/** Must run after requireAuth. */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.user || req.user.role !== "ADMIN") return next(ApiError.forbidden("Admin role required"));
  next();
};

/**
 * Decide role for a newly registering user:
 *  - email matches BOOTSTRAP_ADMIN_EMAIL → ADMIN
 *  - otherwise, the very first user in the DB → ADMIN
 *  - else USER.
 * Must be called inside the same transaction that creates the user.
 */
export async function roleForNewUser(email: string): Promise<Role> {
  if (config.bootstrapAdminEmail && email.toLowerCase() === config.bootstrapAdminEmail) return "ADMIN";
  const count = await prisma.user.count();
  return count === 0 ? "ADMIN" : "USER";
}
