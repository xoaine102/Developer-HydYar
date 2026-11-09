import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { api, ApiError, getAccessToken } from "../lib/api";
import { useApp } from "../store/AppContext";

interface Room {
  id: string;
  name: string;
  description?: string;
}
interface ChatMessage {
  id: string;
  roomId: string;
  user: { id: string; username: string };
  content: string;
  createdAt: string;
}
type ConnStatus = "offline" | "connecting" | "online" | "reconnecting";

const STATUS_META: Record<ConnStatus, { label: string; color: string }> = {
  offline: { label: "Mất kết nối", color: "var(--danger)" },
  connecting: { label: "Đang kết nối…", color: "var(--warning)" },
  online: { label: "Trực tuyến", color: "var(--success)" },
  reconnecting: { label: "Đang kết nối lại…", color: "var(--warning)" },
};

export default function Chat() {
  const { user, toast } = useApp();
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<ConnStatus>("offline");
  const [presence, setPresence] = useState<Record<string, number>>({});
  const socketRef = useRef<Socket | null>(null);
  const joinedRef = useRef<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<Room[]>("/api/chat/rooms").then(setRooms).catch((e) => toast(e instanceof ApiError ? e.message : "Không tải được phòng chat", "error"));
  }, [toast]);

  // Socket lifecycle
  useEffect(() => {
    if (!user) return;
    const token = getAccessToken();
    const socket = io({
      path: "/socket.io",
      transports: ["websocket", "polling"],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
    });
    socketRef.current = socket;
    setStatus("connecting");

    socket.on("connect", () => {
      setStatus("online");
      // Re-join previously joined rooms after reconnect
      joinedRef.current.forEach((r) => socket.emit("join_room", { roomId: r }));
    });
    socket.on("disconnect", () => setStatus("offline"));
    socket.on("reconnect_attempt", () => setStatus("reconnecting"));
    socket.on("connect_error", () => setStatus("reconnecting"));

    socket.on("message", (msg: ChatMessage) => {
      setMessages((m) => ({ ...m, [msg.roomId]: [...(m[msg.roomId] ?? []), msg] }));
    });
    socket.on("presence", (p: { roomId: string; onlineCount: number }) => {
      setPresence((cur) => ({ ...cur, [p.roomId]: p.onlineCount }));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeRoom]);

  const joinRoom = (roomId: string) => {
    if (!user) { toast("Đăng nhập để tham gia chat", "info"); return; }
    setActiveRoom(roomId);
    if (!joinedRef.current.has(roomId)) {
      joinedRef.current.add(roomId);
      socketRef.current?.emit("join_room", { roomId });
    }
  };

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoom || !input.trim() || !socketRef.current) return;
    socketRef.current.emit("message", { roomId: activeRoom, content: input.trim() });
    setInput("");
  };

  const activeRoomObj = rooms?.find((r) => r.id === activeRoom);
  const activeMessages = activeRoom ? messages[activeRoom] ?? [] : [];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <h1 className="text-2xl font-black">Chat cộng đồng</h1>
        <span className="chip" style={{ color: STATUS_META[status].color, borderColor: STATUS_META[status].color }}>
          ● {STATUS_META[status].label}
        </span>
      </div>

      {!user && (
        <div className="surface-card p-4 mb-4 text-sm" style={{ borderLeft: "4px solid var(--warning)" }}>
          Đăng nhập để tham gia chat thời gian thực. Xem danh sách phòng bên dưới.
        </div>
      )}

      <div className="grid md:grid-cols-[240px_1fr] gap-4" style={{ height: "60vh", minHeight: 420 }}>
        <div className="surface-card overflow-y-auto">
          <div className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted border-b border-border">Phòng chat</div>
          {rooms === null && <div className="p-3 text-xs text-muted">Đang tải…</div>}
          {rooms?.map((r) => (
            <button
              key={r.id}
              onClick={() => joinRoom(r.id)}
              className={`w-full text-left px-3 py-2.5 border-b border-border/50 hover:bg-surface-2 transition ${activeRoom === r.id ? "bg-surface-2 font-semibold" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm"># {r.name}</span>
                {presence[r.id] != null && <span className="text-[10px] chip !py-0">{presence[r.id]} online</span>}
              </div>
              {r.description && <div className="text-[11px] text-muted mt-0.5">{r.description}</div>}
            </button>
          ))}
        </div>

        <div className="surface-card flex flex-col overflow-hidden">
          {!activeRoom ? (
            <div className="flex-1 flex items-center justify-center text-muted text-sm p-6 text-center">
              Chọn một phòng bên trái để bắt đầu trò chuyện. Tin nhắn truyền qua Socket.IO thời gian thực.
            </div>
          ) : (
            <>
              <div className="px-4 py-2.5 border-b border-border font-semibold text-sm shrink-0">
                # {activeRoomObj?.name ?? activeRoom}
                {presence[activeRoom] != null && <span className="ml-2 text-xs text-muted">· {presence[activeRoom]} đang online</span>}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {activeMessages.length === 0 && <p className="text-xs text-muted text-center py-8">Chưa có tin nhắn. Hãy gửi lời chào!</p>}
                {activeMessages.map((m) => (
                  <div key={m.id} className={`text-sm ${m.user.id === user?.id ? "text-right" : ""}`}>
                    <div className="text-[10px] text-muted mb-0.5">{m.user.username} · {new Date(m.createdAt).toLocaleTimeString("vi-VN")}</div>
                    <span className={`inline-block px-3 py-1.5 rounded-2xl max-w-[80%] text-left whitespace-pre-wrap ${m.user.id === user?.id ? "brand-gradient text-white" : "bg-surface-2"}`}>
                      {m.content}
                    </span>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              <form onSubmit={send} className="flex gap-2 p-2 border-t border-border shrink-0">
                <input
                  className="input-field !py-2 text-sm flex-1"
                  placeholder={user ? "Nhập tin nhắn…" : "Đăng nhập để gửi"}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={!user || status !== "online"}
                />
                <button type="submit" className="btn-primary !py-2 text-sm" disabled={!user || status !== "online" || !input.trim()}>Gửi</button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
