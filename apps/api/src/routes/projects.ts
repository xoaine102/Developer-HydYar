// Projects + files CRUD. All write routes require auth; every mutation checks
// ownership (owner or ADMIN). Files are upserted by unique [projectId, path].
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { ApiError, asyncHandler } from "../lib/errors.js";
import { requireAuth } from "../lib/auth.js";
import type { ProjectDTO, ProjectFileDTO } from "@hydyar/shared";

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

function toProjectDTO(p: { id: string; name: string; description: string | null; language: string; updatedAt: Date }, fileCount?: number): ProjectDTO {
  return { id: p.id, name: p.name, description: p.description, language: p.language, updatedAt: p.updatedAt.toISOString(), ...(fileCount !== undefined ? { fileCount } : {}) };
}

projectsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const projects = await prisma.project.findMany({
      where: { userId: req.user!.sub },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { files: true } } },
    });
    return res.json(projects.map((p) => toProjectDTO(p, p._count.files)));
  }),
);

const fileSchema = z.object({
  path: z.string().min(1).max(200),
  content: z.string().default(""),
  language: z.string().max(30).optional(),
});

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  language: z.string().max(30).optional(),
  files: z.array(fileSchema).max(50).optional(),
});

projectsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = createProjectSchema.parse(req.body);
    const project = await prisma.project.create({
      data: {
        userId: req.user!.sub,
        name: body.name,
        description: body.description,
        language: body.language ?? "javascript",
        files: body.files?.length
          ? { create: body.files.map((f) => ({ path: f.path, content: f.content, language: f.language })) }
          : undefined,
      },
      include: { files: true },
    });
    const dto = toProjectDTO(project, project.files.length);
    return res.status(201).json({ ...dto, files: project.files.map<ProjectFileDTO>((f) => ({ path: f.path, content: f.content, language: f.language })) });
  }),
);

async function loadOwnedProject(projectId: string, userId: string, role: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, include: { files: true } });
  if (!project) throw ApiError.notFound("Project not found");
  if (project.userId !== userId && role !== "ADMIN") throw ApiError.forbidden("Not the owner of this project");
  return project;
}

projectsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const project = await loadOwnedProject(id, req.user!.sub, req.user!.role);
    return res.json({
      ...toProjectDTO(project, project.files.length),
      files: project.files.map<ProjectFileDTO>((f) => ({ path: f.path, content: f.content, language: f.language })),
    });
  }),
);

const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  language: z.string().max(30).optional(),
});

projectsRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const body = updateProjectSchema.parse(req.body);
    await loadOwnedProject(id, req.user!.sub, req.user!.role);
    const updated = await prisma.project.update({ where: { id }, data: body });
    return res.json(toProjectDTO(updated));
  }),
);

projectsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    await loadOwnedProject(id, req.user!.sub, req.user!.role);
    await prisma.project.delete({ where: { id } });
    return res.json({ deleted: true, id });
  }),
);

const upsertFileSchema = z.object({ path: z.string().min(1).max(200), content: z.string().default(""), language: z.string().max(30).optional() });

projectsRouter.put(
  "/:id/files",
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const body = upsertFileSchema.parse(req.body);
    await loadOwnedProject(id, req.user!.sub, req.user!.role);
    const file = await prisma.projectFile.upsert({
      where: { projectId_path: { projectId: id, path: body.path } },
      create: { projectId: id, path: body.path, content: body.content, language: body.language },
      update: { content: body.content, language: body.language },
    });
    return res.json({ path: file.path, content: file.content, language: file.language });
  }),
);

projectsRouter.delete(
  "/:id/files",
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const pathParam = typeof req.query.path === "string" ? req.query.path : undefined;
    if (!pathParam) throw ApiError.badRequest("Query param ?path= is required");
    await loadOwnedProject(id, req.user!.sub, req.user!.role);
    const deleted = await prisma.projectFile.deleteMany({ where: { projectId: id, path: pathParam } });
    if (deleted.count === 0) throw ApiError.notFound("File not found in this project");
    return res.json({ deleted: true, path: pathParam });
  }),
);
