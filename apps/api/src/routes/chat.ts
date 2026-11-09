// HTTP endpoint for chat room metadata. Real-time messaging lives in
// lib/socket.ts (Socket.IO at /socket.io).
import { Router } from "express";
import { asyncHandler } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

export const chatRouter = Router();

chatRouter.get(
  "/rooms",
  asyncHandler(async (_req, res) => {
    const rooms = await prisma.chatRoom.findMany({ orderBy: { createdAt: "asc" } });
    return res.json(rooms.map((r) => ({ id: r.id, name: r.name, description: r.description })));
  }),
);
