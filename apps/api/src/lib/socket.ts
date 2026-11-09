// Socket.IO layer. Endpoint path: /socket.io. Auth via token in handshake
// (socket.handshake.auth.token, fallback to query token). Events:
//   join_room {roomId}  → server replies with "messages" (last 50) + broadcasts "presence"
//   message {roomId, content} → persisted + broadcast as "message"
//   presence {roomId, onlineCount} broadcast on join/leave
import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { prisma } from "./prisma.js";
import type { AuthUser } from "./auth.js";

interface AuthedSocket extends Socket {
  data: { user?: AuthUser };
}

function onlineCount(io: Server, roomId: string): number {
  return io.sockets.adapter.rooms.get(roomId)?.size ?? 0;
}

export function attachSocket(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    path: "/socket.io",
    cors: {
      origin: config.webOrigin,
      credentials: true,
    },
    // Default ping values; keep connections alive behind Render proxy.
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });

  io.use((socket: AuthedSocket, next) => {
    const token: unknown = socket.handshake.auth?.token ?? socket.handshake.query?.token;
    if (typeof token !== "string" || !token) {
      return next(new Error("UNAUTHENTICATED"));
    }
    try {
      const payload = jwt.verify(token, config.jwtAccessSecret) as jwt.JwtPayload & AuthUser;
      if (!payload.sub) return next(new Error("UNAUTHENTICATED"));
      socket.data.user = { sub: payload.sub, role: payload.role, username: payload.username };
      return next();
    } catch {
      return next(new Error("UNAUTHENTICATED"));
    }
  });

  io.on("connection", (socket: AuthedSocket) => {
    const user = socket.data.user;
    if (!user) return;

    socket.on("join_room", async (payload: { roomId?: string } = {}) => {
      const roomId = payload?.roomId;
      if (!roomId) return;
      const room = await prisma.chatRoom.findUnique({ where: { id: roomId } }).catch(() => null);
      if (!room) {
        socket.emit("error", { code: "NOT_FOUND", message: "Chat room does not exist" });
        return;
      }
      await socket.join(roomId);
      const last = await prisma.chatMessage
        .findMany({
          where: { roomId },
          orderBy: { createdAt: "desc" },
          take: 50,
          include: { user: { select: { id: true, username: true, avatarUrl: true } } },
        })
        .catch(() => []);
      const messages = last
        .reverse()
        .map((m) => ({ id: m.id, roomId: m.roomId, user: { id: m.user.id, username: m.user.username, avatarUrl: m.user.avatarUrl }, content: m.content, createdAt: m.createdAt.toISOString() }));
      socket.emit("messages", { roomId, messages });
      io.to(roomId).emit("presence", { roomId, onlineCount: onlineCount(io, roomId) });
    });

    socket.on("message", async (payload: { roomId?: string; content?: string } = {}) => {
      const roomId = payload?.roomId;
      const content = typeof payload?.content === "string" ? payload.content.trim() : "";
      if (!roomId || !content) return;
      if (!socket.rooms.has(roomId)) return; // must have joined first
      if (content.length > 2000) {
        socket.emit("error", { code: "VALIDATION_ERROR", message: "Message too long (max 2000 chars)" });
        return;
      }
      let saved;
      try {
        saved = await prisma.chatMessage.create({
          data: { roomId, userId: user.sub, content },
          include: { user: { select: { id: true, username: true, avatarUrl: true } } },
        });
      } catch {
        socket.emit("error", { code: "INTERNAL", message: "Could not save message" });
        return;
      }
      io.to(roomId).emit("message", {
        id: saved.id,
        roomId: saved.roomId,
        user: { id: saved.user.id, username: saved.user.username, avatarUrl: saved.user.avatarUrl },
        content: saved.content,
        createdAt: saved.createdAt.toISOString(),
      });
    });

    socket.on("leave_room", async (roomId?: string) => {
      if (typeof roomId !== "string") return;
      await socket.leave(roomId);
      io.to(roomId).emit("presence", { roomId, onlineCount: onlineCount(io, roomId) });
    });

    socket.on("disconnecting", () => {
      // Emit presence for every room this socket is leaving (except its own id room).
      for (const roomId of socket.rooms) {
        if (roomId === socket.id) continue;
        // Count will drop by 1 after disconnect; compute after leave.
        setTimeout(() => {
          io.to(roomId).emit("presence", { roomId, onlineCount: onlineCount(io, roomId) });
        }, 0);
      }
    });
  });

  return io;
}
