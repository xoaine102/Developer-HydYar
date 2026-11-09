import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "../lib/api";
import { useApp, type DocOverlayState, type OverlayEdge } from "../store/AppContext";
import type { LearningDocFull } from "@hydyar/shared";
import MarkdownView from "./MarkdownView";
import { useApp as useAppCtx } from "../store/AppContext";

const SNAP_THRESHOLD = 24;
const PEEK = 8;

interface DragState {
  mode: "move" | "resize";
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  origW: number;
  origH: number;
}

function OverlayWindow({ ov }: { ov: DocOverlayState }) {
  const { focusOverlay, updateOverlay, closeOverlay, toast } = useAppCtx();
  const [content, setContent] = useState<string | null>(ov.content ?? null);
  const [loading, setLoading] = useState(ov.kind === "learning" && !ov.content);
  const [error, setError] = useState<string | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [, force] = useState(0);

  useEffect(() => {
    if (ov.kind !== "learning" || !ov.lang || !ov.slug || ov.content) return;
    let alive = true;
    setLoading(true);
    api<LearningDocFull>(`/api/docs/${ov.lang}/learning/${ov.slug}`)
      .then((d) => {
        if (alive) {
          setContent(d.content);
          setError(null);
        }
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Lỗi tải tài liệu"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [ov.kind, ov.lang, ov.slug, ov.content]);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (d.mode === "move") {
        updateOverlay(ov.id, { x: Math.max(0, Math.min(window.innerWidth - 80, d.origX + dx)), y: Math.max(0, Math.min(window.innerHeight - 40, d.origY + dy)), edge: null, collapsed: false });
      } else {
        updateOverlay(ov.id, { w: Math.max(280, d.origW + dx), h: Math.max(200, d.origH + dy) });
      }
      force((n) => n + 1);
    },
    [ov.id, updateOverlay]
  );

  const onPointerUp = useCallback(() => {
    const d = dragRef.current;
    if (d && d.mode === "move") {
      // Snap detection within 24px of any edge
      const cur = { x: d.origX + (0), y: d.origY + 0 }; // placeholder; read from state via closure below
      void cur;
    }
    dragRef.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    // Re-read current position to decide snap
    // We use a second effect-free approach: compute from last known via DOM
    const el = document.getElementById(`overlay-${ov.id}`);
    if (el) {
      const rect = el.getBoundingClientRect();
      let edge: OverlayEdge = null;
      if (rect.left <= SNAP_THRESHOLD) edge = "left";
      else if (window.innerWidth - rect.right <= SNAP_THRESHOLD) edge = "right";
      else if (rect.top <= SNAP_THRESHOLD) edge = "top";
      else if (window.innerHeight - rect.bottom <= SNAP_THRESHOLD) edge = "bottom";
      if (edge) {
        updateOverlay(ov.id, { edge, collapsed: true });
        toast(`Đã ghim vào mép ${edge === "left" ? "trái" : edge === "right" ? "phải" : edge === "top" ? "trên" : "dưới"}. Di chuột vào dải 8px để mở lại.`, "info");
      }
    }
  }, [ov.id, onPointerMove, updateOverlay, toast]);

  const startDrag = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    focusOverlay(ov.id);
    dragRef.current = { mode: "move", startX: e.clientX, startY: e.clientY, origX: ov.x, origY: ov.y, origW: ov.w, origH: ov.h };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const startResize = (e: React.PointerEvent) => {
    e.stopPropagation();
    focusOverlay(ov.id);
    dragRef.current = { mode: "resize", startX: e.clientX, startY: e.clientY, origX: ov.x, origY: ov.y, origW: ov.w, origH: ov.h };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // Collapsed peek strip
  if (ov.collapsed && ov.edge) {
    const style: React.CSSProperties = { zIndex: ov.z };
    if (ov.edge === "left") Object.assign(style, { left: 0, top: "30%", height: "40%", width: PEEK });
    if (ov.edge === "right") Object.assign(style, { right: 0, top: "30%", height: "40%", width: PEEK });
    if (ov.edge === "top") Object.assign(style, { top: 0, left: "30%", width: "40%", height: PEEK });
    if (ov.edge === "bottom") Object.assign(style, { bottom: 0, left: "30%", width: "40%", height: PEEK });
    return (
      <div
        className="overlay-peek"
        style={style}
        title={ov.title}
        onMouseEnter={() => updateOverlay(ov.id, { collapsed: false })}
        onClick={() => focusOverlay(ov.id)}
      />
    );
  }

  return (
    <div
      id={`overlay-${ov.id}`}
      className="fixed surface-card shadow-overlay flex flex-col overflow-hidden"
      style={{ left: ov.x, top: ov.y, width: ov.w, height: ov.h, zIndex: ov.z, minWidth: 280, minHeight: 200 }}
      onPointerDown={() => focusOverlay(ov.id)}
    >
      {/* Header — drag handle ONLY (per contract: overlay drag only starts from overlay header) */}
      <div
        className="brand-gradient text-white px-3 py-2 flex items-center gap-2 cursor-move select-none shrink-0"
        onPointerDown={startDrag}
      >
        <span className="text-xs opacity-80">⇱</span>
        <span className="font-semibold text-sm flex-1 truncate">{ov.title}</span>
        <button
          className="text-white/80 hover:text-white text-sm px-1"
          onClick={(e) => { e.stopPropagation(); updateOverlay(ov.id, { collapsed: true, edge: ov.edge ?? "right" }); }}
          title="Thu nhỏ vào mép"
        >
          —
        </button>
        <button className="text-white/80 hover:text-white text-sm px-1" onClick={(e) => { e.stopPropagation(); closeOverlay(ov.id); }} title="Đóng">
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 bg-surface">
        {loading && <div className="text-sm text-muted">Đang tải tài liệu…</div>}
        {error && <div className="text-sm" style={{ color: "var(--danger)" }}>{error}</div>}
        {!loading && !error && content && <MarkdownView content={content} />}
        {!loading && !error && !content && <div className="text-sm text-muted">Không có nội dung.</div>}
      </div>
      {/* Resize corner handle */}
      <div
        onPointerDown={startResize}
        className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize"
        style={{ background: "linear-gradient(135deg, transparent 50%, var(--accent-purple) 50%)", borderBottomRightRadius: 12 }}
        title="Kéo để thay đổi kích thước"
      />
    </div>
  );
}

export default function DocOverlayHost() {
  const { overlays } = useApp();
  return (
    <>
      {overlays.map((ov) => (
        <OverlayWindow key={ov.id} ov={ov} />
      ))}
    </>
  );
}
