// Admin endpoints: platform stats, post report queue + resolve.
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { ApiError, asyncHandler } from "../lib/errors.js";
import { requireAdmin, requireAuth } from "../lib/auth.js";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

adminRouter.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const [users, projects, posts, pendingSuggestions, executionsToday] = await Promise.all([
      prisma.user.count(),
      prisma.project.count(),
      prisma.forumPost.count(),
      prisma.docSuggestion.count({ where: { status: "PENDING" } }),
      prisma.executionLog.count({ where: { createdAt: { gte: startOfToday } } }),
    ]);
    return res.json({ users, projects, posts, pendingSuggestions, executionsToday });
  }),
);

adminRouter.get(
  "/reports",
  asyncHandler(async (_req, res) => {
    const reports = await prisma.postReport.findMany({
      where: { status: "open" },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, username: true } },
        post: { select: { id: true, title: true, userId: true } },
      },
    });
    return res.json(
      reports.map((r) => ({
        id: r.id,
        reason: r.reason,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        reportedBy: { id: r.user.id, username: r.user.username },
        post: { id: r.post.id, title: r.post.title },
      })),
    );
  }),
);

const resolveReportSchema = z.object({ status: z.enum(["resolved", "dismissed", "open"]) });

adminRouter.patch(
  "/reports/:id",
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const body = resolveReportSchema.parse(req.body);
    const report = await prisma.postReport.findUnique({ where: { id } });
    if (!report) throw ApiError.notFound("Report not found");
    const updated = await prisma.postReport.update({ where: { id }, data: { status: body.status } });
    return res.json({ id: updated.id, status: updated.status });
  }),
);
