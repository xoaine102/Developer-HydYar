// Community doc suggestions. Users submit; admin approves/rejects.
// On APPROVE of a LEARNING suggestion it is inserted into LearningDoc;
// on APPROVE of an APPLICATION suggestion (JSON content) it becomes an AppDocEntry.
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { ApiError, asyncHandler } from "../lib/errors.js";
import { requireAdmin, requireAuth } from "../lib/auth.js";
import type { DocSuggestionDTO } from "@hydyar/shared";

export const suggestionsRouter = Router();

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "doc";
}

const createSchema = z.object({
  kind: z.enum(["LEARNING", "APPLICATION"]),
  lang: z.string().min(1).max(30),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(50_000),
});

suggestionsRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const s = await prisma.docSuggestion.create({
      data: { userId: req.user!.sub, kind: body.kind, lang: body.lang, title: body.title, content: body.content },
      include: { user: { select: { username: true } } },
    });
    const dto: DocSuggestionDTO = {
      id: s.id,
      kind: s.kind,
      lang: s.lang,
      title: s.title,
      status: s.status,
      feedback: s.feedback,
      createdAt: s.createdAt.toISOString(),
      author: { username: s.user.username },
    };
    return res.status(201).json(dto);
  }),
);

suggestionsRouter.get(
  "/mine",
  requireAuth,
  asyncHandler(async (req, res) => {
    const mine = await prisma.docSuggestion.findMany({
      where: { userId: req.user!.sub },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { username: true } } },
    });
    return res.json(
      mine.map<DocSuggestionDTO>((s) => ({
        id: s.id,
        kind: s.kind,
        lang: s.lang,
        title: s.title,
        status: s.status,
        feedback: s.feedback,
        createdAt: s.createdAt.toISOString(),
        author: { username: s.user.username },
      })),
    );
  }),
);

suggestionsRouter.get(
  "/",
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const all = await prisma.docSuggestion.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: { user: { select: { username: true } } },
    });
    return res.json(
      all.map<DocSuggestionDTO & { content: string }>((s) => ({
        id: s.id,
        kind: s.kind,
        lang: s.lang,
        title: s.title,
        status: s.status,
        feedback: s.feedback,
        createdAt: s.createdAt.toISOString(),
        author: { username: s.user.username },
        content: s.content,
      })),
    );
  }),
);

const patchSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  feedback: z.string().max(2000).optional(),
});

suggestionsRouter.patch(
  "/:id",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const body = patchSchema.parse(req.body);
    const suggestion = await prisma.docSuggestion.findUnique({ where: { id } });
    if (!suggestion) throw ApiError.notFound("Suggestion not found");

    let insertNote: string | undefined;
    if (body.status === "APPROVED" && suggestion.status === "PENDING") {
      if (suggestion.kind === "LEARNING") {
        let slug = slugify(suggestion.title);
        let n = 2;
        while (await prisma.learningDoc.findUnique({ where: { lang_slug: { lang: suggestion.lang, slug } } })) {
          slug = `${slugify(suggestion.title)}-${n++}`;
        }
        const maxOrder = await prisma.learningDoc.aggregate({ where: { lang: suggestion.lang }, _max: { orderIdx: true } });
        await prisma.learningDoc.create({
          data: {
            lang: suggestion.lang,
            slug,
            title: suggestion.title,
            content: suggestion.content,
            summary: suggestion.content.slice(0, 200),
            orderIdx: (maxOrder._max.orderIdx ?? -1) + 1,
          },
        });
        insertNote = `Inserted as learning doc /docs/${suggestion.lang}/learn/${slug}`;
      } else {
        // APPLICATION: content is expected to be JSON of the AppDocEntry fields.
        let parsed: { category?: string; component?: string; rule?: string; explanation?: string; example?: string; exampleNote?: string } | null = null;
        try {
          parsed = JSON.parse(suggestion.content);
        } catch {
          parsed = null;
        }
        if (parsed && parsed.category && parsed.component && parsed.rule && parsed.explanation && parsed.example) {
          const maxOrder = await prisma.appDocEntry.aggregate({ where: { lang: suggestion.lang, category: parsed.category }, _max: { orderIdx: true } });
          await prisma.appDocEntry.create({
            data: {
              lang: suggestion.lang,
              category: parsed.category,
              component: parsed.component,
              rule: parsed.rule,
              explanation: parsed.explanation,
              example: parsed.example,
              exampleNote: parsed.exampleNote ?? null,
              orderIdx: (maxOrder._max.orderIdx ?? -1) + 1,
            },
          });
          insertNote = `Inserted as application entry in category "${parsed.category}"`;
        } else {
          insertNote = "Approved but content was not valid application JSON (expected {category,component,rule,explanation,example}); not inserted.";
        }
      }
    }

    const updated = await prisma.docSuggestion.update({
      where: { id },
      data: {
        status: body.status,
        feedback: body.feedback ?? insertNote ?? suggestion.feedback,
        reviewerId: req.user!.sub,
        reviewedAt: new Date(),
      },
      include: { user: { select: { username: true } } },
    });
    return res.json({
      id: updated.id,
      kind: updated.kind,
      lang: updated.lang,
      title: updated.title,
      status: updated.status,
      feedback: updated.feedback,
      createdAt: updated.createdAt.toISOString(),
      author: { username: updated.user.username },
      ...(insertNote ? { insertNote } : {}),
    });
  }),
);
