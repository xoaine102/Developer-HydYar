// Forum: posts CRUD, nested comments, like toggle, report. Ownership enforced on delete.
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { ApiError, asyncHandler } from "../lib/errors.js";
import { optionalAuth, requireAuth } from "../lib/auth.js";
import type { CommentDTO, ForumPostDTO } from "@hydyar/shared";

export const forumRouter = Router();

interface PostWithCounts {
  id: string;
  title: string;
  content: string;
  codeSnippet: string | null;
  language: string | null;
  tags: string[];
  createdAt: Date;
  editedAt: Date | null;
  user: { id: string; username: string; avatarUrl: string | null };
  _count: { comments: number; likes: number };
}

function toPostDTO(p: PostWithCounts, likedByMe: boolean): ForumPostDTO {
  return {
    id: p.id,
    title: p.title,
    content: p.content,
    codeSnippet: p.codeSnippet,
    language: p.language,
    tags: p.tags,
    createdAt: p.createdAt.toISOString(),
    editedAt: p.editedAt?.toISOString() ?? null,
    author: { id: p.user.id, username: p.user.username, avatarUrl: p.user.avatarUrl },
    likeCount: p._count.likes,
    commentCount: p._count.comments,
    likedByMe,
  };
}

forumRouter.get(
  "/posts",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const tag = typeof req.query.tag === "string" && req.query.tag.trim() ? req.query.tag.trim() : undefined;
    const q = typeof req.query.q === "string" && req.query.q.trim() ? req.query.q.trim() : undefined;
    const userId = req.user?.sub;
    const posts = (await prisma.forumPost.findMany({
      where: {
        ...(tag ? { tags: { has: tag } } : {}),
        ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { content: { contains: q, mode: "insensitive" } }] } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { id: true, username: true, avatarUrl: true } }, _count: { select: { comments: true, likes: true } } },
    })) as PostWithCounts[];

    let likedSet = new Set<string>();
    if (userId) {
      const liked = await prisma.postLike.findMany({ where: { userId, postId: { in: posts.map((p) => p.id) } }, select: { postId: true } });
      likedSet = new Set(liked.map((l) => l.postId));
    }
    return res.json(posts.map((p) => toPostDTO(p, likedSet.has(p.id))));
  }),
);

const createPostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(20_000),
  codeSnippet: z.string().max(20_000).optional(),
  language: z.string().max(30).optional(),
  tags: z.array(z.string().max(30)).max(10).default([]),
  projectId: z.string().optional(),
});

forumRouter.post(
  "/posts",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = createPostSchema.parse(req.body);
    if (body.projectId) {
      const project = await prisma.project.findUnique({ where: { id: body.projectId }, select: { userId: true } });
      if (!project) throw ApiError.notFound("Referenced project not found");
      if (project.userId !== req.user!.sub) throw ApiError.forbidden("Can only reference your own project");
    }
    const post = await prisma.forumPost.create({
      data: {
        userId: req.user!.sub,
        title: body.title,
        content: body.content,
        codeSnippet: body.codeSnippet,
        language: body.language,
        tags: body.tags,
        projectId: body.projectId,
      },
      include: { user: { select: { id: true, username: true, avatarUrl: true } }, _count: { select: { comments: true, likes: true } } },
    });
    return res.status(201).json(toPostDTO(post as PostWithCounts, false));
  }),
);

function buildCommentTree(flat: Array<{ id: string; postId: string; parentId: string | null; content: string; codeSnippet: string | null; createdAt: Date; user: { id: string; username: string } }>): CommentDTO[] {
  const byId = new Map<string, CommentDTO>();
  const roots: CommentDTO[] = [];
  for (const c of flat) {
    byId.set(c.id, {
      id: c.id,
      postId: c.postId,
      parentId: c.parentId,
      content: c.content,
      codeSnippet: c.codeSnippet,
      createdAt: c.createdAt.toISOString(),
      author: { id: c.user.id, username: c.user.username },
      replies: [],
    });
  }
  for (const c of flat) {
    const node = byId.get(c.id)!;
    if (c.parentId && byId.has(c.parentId)) {
      byId.get(c.parentId)!.replies!.push(node);
    } else {
      roots.push(node);
    }
  }
  // Strip empty replies arrays for leaves? Keep as [] for consistent shape.
  return roots;
}

forumRouter.get(
  "/posts/:id",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const post = await prisma.forumPost.findUnique({
      where: { id },
      include: { user: { select: { id: true, username: true, avatarUrl: true } }, _count: { select: { comments: true, likes: true } } },
    });
    if (!post) throw ApiError.notFound("Post not found");
    const comments = await prisma.comment.findMany({
      where: { postId: id },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { id: true, username: true } } },
    });
    let likedByMe = false;
    if (req.user?.sub) {
      likedByMe = (await prisma.postLike.findUnique({ where: { userId_postId: { userId: req.user.sub, postId: id } } })) !== null;
    }
    return res.json({ ...toPostDTO(post as PostWithCounts, likedByMe), comments: buildCommentTree(comments) });
  }),
);

forumRouter.delete(
  "/posts/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const post = await prisma.forumPost.findUnique({ where: { id }, select: { userId: true } });
    if (!post) throw ApiError.notFound("Post not found");
    if (post.userId !== req.user!.sub && req.user!.role !== "ADMIN") throw ApiError.forbidden("Only the author or an admin can delete this post");
    await prisma.forumPost.delete({ where: { id } });
    return res.json({ deleted: true, id });
  }),
);

const createCommentSchema = z.object({
  content: z.string().min(1).max(10_000),
  parentId: z.string().optional(),
  codeSnippet: z.string().max(20_000).optional(),
});

forumRouter.post(
  "/posts/:id/comments",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const body = createCommentSchema.parse(req.body);
    const post = await prisma.forumPost.findUnique({ where: { id }, select: { id: true } });
    if (!post) throw ApiError.notFound("Post not found");
    if (body.parentId) {
      const parent = await prisma.comment.findUnique({ where: { id: body.parentId }, select: { postId: true } });
      if (!parent || parent.postId !== id) throw ApiError.badRequest("parentId does not belong to this post");
    }
    const comment = await prisma.comment.create({
      data: { postId: id, userId: req.user!.sub, content: body.content, parentId: body.parentId, codeSnippet: body.codeSnippet },
      include: { user: { select: { id: true, username: true } } },
    });
    return res.status(201).json({
      id: comment.id,
      postId: comment.postId,
      parentId: comment.parentId,
      content: comment.content,
      codeSnippet: comment.codeSnippet,
      createdAt: comment.createdAt.toISOString(),
      author: { id: comment.user.id, username: comment.user.username },
    });
  }),
);

forumRouter.delete(
  "/comments/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const comment = await prisma.comment.findUnique({ where: { id }, select: { userId: true } });
    if (!comment) throw ApiError.notFound("Comment not found");
    if (comment.userId !== req.user!.sub && req.user!.role !== "ADMIN") throw ApiError.forbidden("Only the author or an admin can delete this comment");
    await prisma.comment.delete({ where: { id } });
    return res.json({ deleted: true, id });
  }),
);

forumRouter.post(
  "/posts/:id/like",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const post = await prisma.forumPost.findUnique({ where: { id }, select: { id: true } });
    if (!post) throw ApiError.notFound("Post not found");
    const existing = await prisma.postLike.findUnique({ where: { userId_postId: { userId: req.user!.sub, postId: id } } });
    let liked: boolean;
    if (existing) {
      await prisma.postLike.delete({ where: { userId_postId: { userId: req.user!.sub, postId: id } } });
      liked = false;
    } else {
      await prisma.postLike.create({ data: { userId: req.user!.sub, postId: id } });
      liked = true;
    }
    const likeCount = await prisma.postLike.count({ where: { postId: id } });
    return res.json({ liked, likeCount });
  }),
);

forumRouter.post(
  "/posts/:id/report",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const { reason } = z.object({ reason: z.string().min(3).max(500) }).parse(req.body);
    const post = await prisma.forumPost.findUnique({ where: { id }, select: { id: true } });
    if (!post) throw ApiError.notFound("Post not found");
    await prisma.postReport.create({ data: { userId: req.user!.sub, postId: id, reason } });
    return res.status(201).json({ reported: true });
  }),
);
