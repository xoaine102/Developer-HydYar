// Docs routes: languages, learning list, learning by slug, application entries.
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { ApiError, asyncHandler } from "../lib/errors.js";
import type { AppDocEntryDTO, LearningDocFull, LearningDocMeta } from "@hydyar/shared";

export const docsRouter = Router();

const LANG_NAMES: Record<string, string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
  lua: "Lua",
  c: "C",
  cpp: "C++",
  php: "PHP",
  html: "HTML",
  css: "CSS",
  sql: "SQL",
  java: "Java",
  csharp: "C#",
  go: "Go",
  rust: "Rust",
  bash: "Bash",
  json: "JSON",
  markdown: "Markdown",
};

docsRouter.get(
  "/languages",
  asyncHandler(async (_req, res) => {
    const [learning, apps] = await Promise.all([
      prisma.learningDoc.groupBy({ by: ["lang"], _count: { _all: true } }),
      prisma.appDocEntry.groupBy({ by: ["lang"], _count: { _all: true } }),
    ]);
    const map = new Map<string, { code: string; name: string; learningCount: number; appEntryCount: number }>();
    for (const row of learning) {
      map.set(row.lang, { code: row.lang, name: LANG_NAMES[row.lang] ?? row.lang, learningCount: row._count._all, appEntryCount: 0 });
    }
    for (const row of apps) {
      const existing = map.get(row.lang);
      if (existing) existing.appEntryCount = row._count._all;
      else map.set(row.lang, { code: row.lang, name: LANG_NAMES[row.lang] ?? row.lang, learningCount: 0, appEntryCount: row._count._all });
    }
    const result = [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
    return res.json(result);
  }),
);

const langParam = z.object({ lang: z.string().min(1).max(30) });

docsRouter.get(
  "/:lang/learning",
  asyncHandler(async (req, res) => {
    const { lang } = langParam.parse(req.params);
    const docs = await prisma.learningDoc.findMany({
      where: { lang },
      orderBy: [{ orderIdx: "asc" }, { createdAt: "asc" }],
    });
    const meta: LearningDocMeta[] = docs.map((d) => ({
      lang: d.lang,
      slug: d.slug,
      title: d.title,
      level: d.level,
      orderIdx: d.orderIdx,
      summary: d.summary,
    }));
    return res.json(meta);
  }),
);

docsRouter.get(
  "/:lang/learning/:slug",
  asyncHandler(async (req, res) => {
    const { lang, slug } = z.object({ lang: z.string().min(1), slug: z.string().min(1) }).parse(req.params);
    const doc = await prisma.learningDoc.findUnique({ where: { lang_slug: { lang, slug } } });
    if (!doc) throw ApiError.notFound(`Learning doc "${slug}" not found for ${lang}`);
    const full: LearningDocFull = {
      lang: doc.lang,
      slug: doc.slug,
      title: doc.title,
      level: doc.level,
      orderIdx: doc.orderIdx,
      summary: doc.summary,
      content: doc.content,
      related: doc.related,
    };
    return res.json(full);
  }),
);

docsRouter.get(
  "/:lang/application",
  asyncHandler(async (req, res) => {
    const { lang } = langParam.parse(req.params);
    const category = typeof req.query.category === "string" && req.query.category.trim() ? req.query.category.trim() : undefined;
    const entries = await prisma.appDocEntry.findMany({
      where: { lang, ...(category ? { category } : {}) },
      orderBy: [{ category: "asc" }, { orderIdx: "asc" }],
    });
    const dto: AppDocEntryDTO[] = entries.map((e) => ({
      id: e.id,
      lang: e.lang,
      category: e.category,
      component: e.component,
      rule: e.rule,
      explanation: e.explanation,
      example: e.example,
      exampleNote: e.exampleNote,
      orderIdx: e.orderIdx,
    }));
    return res.json(dto);
  }),
);
