import React, { useRef, useCallback } from "react";

/**
 * Application-doc table wrapper implementing scroll-direction lock per DESIGN_TOKENS.md:
 * - pointerdown records start x/y
 * - first pointermove beyond 6px decides axis (|dx|>|dy| -> horizontal else vertical)
 * - sets touch-action:none + locks that axis via overflow toggling until pointerup
 * Horizontal scroll never conflicts with overlay drag (overlay drag only starts from overlay header).
 */
export default function ScrollLockTable({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number; decided: "h" | "v" | null }>({ x: 0, y: 0, decided: null });

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY, decided: null };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const s = start.current;
    if (s.decided) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
    const horizontal = Math.abs(dx) > Math.abs(dy);
    s.decided = horizontal ? "h" : "v";
    el.style.touchAction = "none";
    if (horizontal) {
      el.style.overflowY = "hidden";
      el.style.overflowX = "auto";
    } else {
      el.style.overflowX = "hidden";
      el.style.overflowY = "auto";
    }
  }, []);

  const endLock = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    start.current.decided = null;
    el.style.touchAction = "";
    el.style.overflowX = "auto";
    el.style.overflowY = "auto";
  }, []);

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endLock}
      onPointerCancel={endLock}
      onPointerLeave={endLock}
      className={`overflow-auto ${className}`}
      style={{ overflowX: "auto", overflowY: "auto", touchAction: "auto" }}
    >
      {children}
    </div>
  );
}
