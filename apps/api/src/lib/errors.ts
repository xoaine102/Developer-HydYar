// Error types, async wrapper, and the global error handler.
// Every error response has the frozen shape: { error: { code, message } }.
import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
  static badRequest(message = "Invalid request") {
    return new ApiError(400, "VALIDATION_ERROR", message);
  }
  static unauthorized(message = "Authentication required") {
    return new ApiError(401, "UNAUTHENTICATED", message);
  }
  static forbidden(message = "Forbidden") {
    return new ApiError(403, "FORBIDDEN", message);
  }
  static notFound(message = "Not found") {
    return new ApiError(404, "NOT_FOUND", message);
  }
  static conflict(message = "Conflict") {
    return new ApiError(409, "CONFLICT", message);
  }
  static rateLimited(message = "Too many requests, slow down") {
    return new ApiError(429, "RATE_LIMITED", message);
  }
}

/** Wrap an async route so rejected promises reach the error handler. */
export function asyncHandler(
  fn: (req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1], next: Parameters<RequestHandler>[2]) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const path = first?.path.length ? first.path.join(".") : "body";
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: `${path}: ${first?.message ?? "invalid value"}` },
    });
  }
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  // Prisma unique constraint violation → 409
  if (err && typeof err === "object" && (err as { code?: string }).code === "P2002") {
    return res.status(409).json({ error: { code: "CONFLICT", message: "A record with this value already exists" } });
  }
  console.error("[api] unhandled error:", err);
  return res.status(500).json({ error: { code: "INTERNAL", message: "Internal server error" } });
};

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: `Route not found: ${req.method} ${req.path}` } });
};
