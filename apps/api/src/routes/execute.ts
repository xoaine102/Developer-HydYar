// Execution routes: POST /api/execute → 202 queued; GET /api/execute/:runId → poll.
// Rate-limited (10/min) at mount time in index.ts.
import { Router } from "express";
import { z } from "zod";
import { ApiError, asyncHandler } from "../lib/errors.js";
import { requireAuth } from "../lib/auth.js";
import { enqueueRun, getRun } from "../lib/execute.js";
import type { ExecuteRequest, ExecuteResponse } from "@hydyar/shared";

export const executeRouter = Router();
executeRouter.use(requireAuth);

const executeSchema = z.object({
  language: z.string().min(1).max(30),
  code: z.string().max(200_000, "Code too large (max 200KB)"),
  files: z
    .array(z.object({ path: z.string().min(1).max(200), content: z.string().default(""), language: z.string().max(30).optional() }))
    .max(50)
    .optional(),
  stdin: z.string().max(64_000).optional(),
});

executeRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = executeSchema.parse(req.body) as ExecuteRequest;
    let runId: string;
    try {
      runId = enqueueRun(body, req.user!.sub);
    } catch (e) {
      if (e && typeof e === "object" && (e as { code?: string }).code === "QUEUE_FULL") {
        throw new ApiError(429, "QUEUE_FULL", "Execution queue is full, try again shortly");
      }
      throw e;
    }
    const state = getRun(runId)!;
    // Contract: POST always answers 202 with status:"queued"; the true state is read via GET poll.
    return res.status(202).json({ runId, status: "queued", message: state.message, runtime: state.runtime });
  }),
);

executeRouter.get(
  "/:runId",
  asyncHandler(async (req, res) => {
    const { runId } = z.object({ runId: z.string().uuid() }).parse(req.params);
    const state = getRun(runId);
    if (!state) throw ApiError.notFound("Run not found (it may have expired after 10 minutes)");
    const response: ExecuteResponse = {
      runId: state.runId,
      status: state.status,
      runtime: state.runtime,
      ...(state.stdout !== undefined ? { stdout: state.stdout } : {}),
      ...(state.stderr !== undefined ? { stderr: state.stderr } : {}),
      ...(state.durationMs !== undefined ? { durationMs: state.durationMs } : {}),
      ...(state.message ? { message: state.message } : {}),
    };
    return res.json(response);
  }),
);
