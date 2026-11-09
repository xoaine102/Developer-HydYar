// Search across learning docs, app entries, forum posts, projects, and languages.
// Uses case-insensitive ILIKE via lower() (works on stock Postgres; tsvector with
// unaccent would be the production optimization — the contract allows this fallback).
// Returned href values match the frontend routes declared in CONTRACT.md.
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/errors.js";
import type { SearchResultItem } from "@hydyar/shared";

export const searchRouter = Router();

interface RawRow {
  type: string;
  id: string;
  title: string;
  snippet: string;
  lang: string | null;
  slug: string | null;
}

function hrefFor(row: RawRow): string {
  switch (row.type) {
    case "learning-doc":
      return `/docs/${row.lang}/learn/${row.slug}`;
    case "app-doc":
      return `/docs/${row.lang}/reference`;
    case "project":
      return `/ide/${row.id}`;
    case "post":
      return `/community/forum`;
    case "language":
      return `/docs/${row.id}`;
    default:
      return `/`;
  }
}

searchRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const typeFilter = typeof req.query.type === "string" ? req.query.type.trim() : undefined;
    if (!q) return res.json([]);
    const term = `%${q.toLowerCase()}%`;

    const rows = (await prisma.$queryRaw<RawRow[]>`
      SELECT 'learning-doc'::text AS type, "id"::text AS id, "title", left(coalesce("summary",'') || ' ' || "content", 160) AS snippet, "lang", "slug"
      FROM "LearningDoc" WHERE lower("title") LIKE ${term} OR lower(coalesce("summary",'')) LIKE ${term} OR lower("content") LIKE ${term}
      UNION ALL
      SELECT 'app-doc'::text, "id"::text, "component", left(coalesce("explanation",'') || ' ' || "rule", 160), "lang", NULL
      FROM "AppDocEntry" WHERE lower("component") LIKE ${term} OR lower("rule") LIKE ${term} OR lower("explanation") LIKE ${term}
      UNION ALL
      SELECT 'post'::text, "id"::text, "title", left("content", 160), NULL, NULL
      FROM "ForumPost" WHERE lower("title") LIKE ${term} OR lower("content") LIKE ${term}
      UNION ALL
      SELECT 'project'::text, "id"::text, "name", left(coalesce("description",''), 160), NULL, NULL
      FROM "Project" WHERE lower("name") LIKE ${term} OR lower(coalesce("description",'')) LIKE ${term}
      UNION ALL
      SELECT DISTINCT 'language'::text, "lang" AS id, "lang" AS title, '' AS snippet, NULL, NULL
      FROM "LearningDoc" WHERE lower("lang") LIKE ${term}
      LIMIT 50
    `) as RawRow[];

    const filtered = typeFilter ? rows.filter((r) => r.type === typeFilter) : rows;
    const items: SearchResultItem[] = filtered.map((r) => ({
      type: r.type as SearchResultItem["type"],
      id: r.id,
      title: r.title,
      snippet: r.snippet ?? "",
      ...(r.lang ? { lang: r.lang } : {}),
      ...(r.slug ? { slug: r.slug } : {}),
      href: hrefFor(r),
    }));
    return res.json(items);
  }),
);
