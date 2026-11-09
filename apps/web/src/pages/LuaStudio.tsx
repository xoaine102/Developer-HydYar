import { useCallback, useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { useApp } from "../store/AppContext";

interface SceneObject {
  id: number;
  type: "rect" | "circle" | "line" | "text";
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  text?: string;
}

const CANVAS_W = 480;
const CANVAS_H = 320;
const MARKER_BEGIN = "-- hydyar:scene:begin";
const MARKER_END = "-- hydyar:scene:end";

let idSeq = 100;

const DEFAULT_CODE = `-- HydYar Lua Graphics Studio
-- Code thủ công NGOÀI khối marker được giữ nguyên khi bạn chỉnh sửa trực quan.
-- hydyar.time (giây) và hydyar.frame có sẵn trong vòng lặp hoạt hình.

local hue = 0
hydyar.loop(function(t)
  hue = (hue + 2) % 360
  local r = 140 + math.sin(t * 2) * 30
  hydyar.circle(240, 160, r, string.format("hsl(%d, 80%%, 60%%)", hue))
end)

${MARKER_BEGIN}
hydyar.rect(40, 40, 120, 80, "#6FA8FF")
hydyar.circle(300, 80, 35, "#8F7CFF")
hydyar.line(40, 260, 440, 260, "#1E1B3A")
hydyar.text(60, 240, "HydYar Lua!", "#8F7CFF")
${MARKER_END}
`;

function sceneToMarker(objects: SceneObject[]): string {
  const lines = objects.map((o) => {
    const c = JSON.stringify(o.color);
    if (o.type === "rect") return `hydyar.rect(${o.x}, ${o.y}, ${o.w}, ${o.h}, ${c})`;
    if (o.type === "circle") return `hydyar.circle(${o.x}, ${o.y}, ${Math.round(o.w / 2)}, ${c})`;
    if (o.type === "line") return `hydyar.line(${o.x}, ${o.y}, ${o.x + o.w}, ${o.y + o.h}, ${c})`;
    return `hydyar.text(${o.x}, ${o.y}, ${JSON.stringify(o.text ?? "")}, ${c})`;
  });
  return `${MARKER_BEGIN}\n${lines.join("\n")}\n${MARKER_END}`;
}

function replaceMarker(code: string, marker: string): string {
  const re = new RegExp(`${MARKER_BEGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${MARKER_END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
  if (re.test(code)) return code.replace(re, marker);
  return code + "\n" + marker + "\n";
}

function parseMarker(code: string): SceneObject[] | null {
  const re = new RegExp(`${MARKER_BEGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([\\s\\S]*?)${MARKER_END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
  const m = re.exec(code);
  if (!m) return [];
  const objs: SceneObject[] = [];
  const lines = m[1].split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("--"));
  for (const line of lines) {
    const num = "-?\\d+(?:\\.\\d+)?";
    const str = '"((?:[^"\\\\]|\\\\.)*)"|\'((?:[^\'\\\\]|\\\\.)*)\'';
    let mm = new RegExp(`hydyar\\.rect\\(\\s*(${num})\\s*,\\s*(${num})\\s*,\\s*(${num})\\s*,\\s*(${num})\\s*,\\s*${str}\\s*\\)`).exec(line);
    if (mm) { objs.push({ id: idSeq++, type: "rect", x: +mm[1], y: +mm[2], w: +mm[3], h: +mm[4], color: mm[5] ?? mm[6] ?? "#6FA8FF" }); continue; }
    mm = new RegExp(`hydyar\\.circle\\(\\s*(${num})\\s*,\\s*(${num})\\s*,\\s*(${num})\\s*,\\s*${str}\\s*\\)`).exec(line);
    if (mm) { objs.push({ id: idSeq++, type: "circle", x: +mm[1], y: +mm[2], w: +mm[3] * 2, h: +mm[3] * 2, color: mm[4] ?? mm[5] ?? "#8F7CFF" }); continue; }
    mm = new RegExp(`hydyar\\.line\\(\\s*(${num})\\s*,\\s*(${num})\\s*,\\s*(${num})\\s*,\\s*(${num})\\s*,\\s*${str}\\s*\\)`).exec(line);
    if (mm) { objs.push({ id: idSeq++, type: "line", x: +mm[1], y: +mm[2], w: +mm[3] - +mm[1], h: +mm[4] - +mm[2], color: mm[5] ?? mm[6] ?? "#1E1B3A" }); continue; }
    mm = new RegExp(`hydyar\\.text\\(\\s*(${num})\\s*,\\s*(${num})\\s*,\\s*${str}\\s*,\\s*${str}\\s*\\)`).exec(line);
    if (mm) { objs.push({ id: idSeq++, type: "text", x: +mm[1], y: +mm[2], w: 120, h: 20, text: mm[3] ?? mm[4] ?? "", color: mm[5] ?? mm[6] ?? "#8F7CFF" }); continue; }
    return null; // unparseable line → fail whole parse
  }
  return objs;
}

export default function LuaStudio() {
  const { toast, theme } = useApp();
  const [code, setCode] = useState(DEFAULT_CODE);
  const [objects, setObjects] = useState<SceneObject[]>(() => parseMarker(DEFAULT_CODE) ?? []);
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: number; mode: "move" | "resize"; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number } | null>(null);
  const rafRef = useRef<number>(0);

  const sel = objects.find((o) => o.id === selected) ?? null;

  // Push scene → code (regenerate marker only)
  const syncSceneToCode = useCallback((objs: SceneObject[]) => {
    setCode((c) => replaceMarker(c, sceneToMarker(objs)));
  }, []);

  const updateObj = (id: number, patch: Partial<SceneObject>) => {
    setObjects((os) => {
      const next = os.map((o) => (o.id === id ? { ...o, ...patch } : o));
      syncSceneToCode(next);
      return next;
    });
  };

  const addShape = (type: SceneObject["type"]) => {
    const o: SceneObject = {
      id: idSeq++, type, x: 60 + objects.length * 12, y: 60 + objects.length * 12,
      w: type === "circle" ? 60 : type === "line" ? 150 : 100,
      h: type === "circle" ? 60 : type === "line" ? 0 : type === "text" ? 24 : 70,
      color: type === "rect" ? "#6FA8FF" : type === "circle" ? "#8F7CFF" : "#1E1B3A",
      text: type === "text" ? "Văn bản" : undefined,
    };
    const next = [...objects, o];
    setObjects(next);
    setSelected(o.id);
    syncSceneToCode(next);
  };

  const removeSelected = () => {
    if (selected == null) return;
    const next = objects.filter((o) => o.id !== selected);
    setObjects(next);
    setSelected(null);
    syncSceneToCode(next);
  };

  // Parse code → scene (two-way). On failure: toast, NO overwrite.
  const syncCodeToScene = () => {
    const parsed = parseMarker(code);
    if (parsed === null) {
      toast("Phần code thủ công không thể đồng bộ tự động — giữ nguyên cảnh hiện tại.", "error");
      return;
    }
    setObjects(parsed);
    setSelected(null);
    toast(`Đã đồng bộ ${parsed.length} đối tượng từ code.`, "success");
  };

  // ===== Fengari execution + animation loop =====
  useEffect(() => {
    let alive = true;
    let cancelled = false;
    const run = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const fengari = await import("fengari-web");
      if (cancelled) return;
      const { lua, lauxlib, lualib, to_luastring, to_jsstring } = fengari;
      const L = lauxlib.luaL_newstate();
      lualib.luaL_openlibs(L);

      const loopFns: any[] = [];
      let frame = 0;
      const start = performance.now();

      const pushHydyar = () => {
        lua.lua_newtable(L);
        // rect(x,y,w,h,color)
        lua.lua_pushcfunction(L, (st: any) => {
          const x = lua.lua_tonumber(st, 1), y = lua.lua_tonumber(st, 2), w = lua.lua_tonumber(st, 3), h = lua.lua_tonumber(st, 4);
          const color = to_jsstring(lua.lua_tostring(st, 5));
          ctx.fillStyle = color;
          ctx.fillRect(x, y, w, h);
          return 0;
        });
        lua.lua_setfield(L, -2, to_luastring("rect"));
        lua.lua_pushcfunction(L, (st: any) => {
          const x = lua.lua_tonumber(st, 1), y = lua.lua_tonumber(st, 2), r = lua.lua_tonumber(st, 3);
          const color = to_jsstring(lua.lua_tostring(st, 4));
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
          return 0;
        });
        lua.lua_setfield(L, -2, to_luastring("circle"));
        lua.lua_pushcfunction(L, (st: any) => {
          const x1 = lua.lua_tonumber(st, 1), y1 = lua.lua_tonumber(st, 2), x2 = lua.lua_tonumber(st, 3), y2 = lua.lua_tonumber(st, 4);
          const color = to_jsstring(lua.lua_tostring(st, 5));
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          return 0;
        });
        lua.lua_setfield(L, -2, to_luastring("line"));
        lua.lua_pushcfunction(L, (st: any) => {
          const x = lua.lua_tonumber(st, 1), y = lua.lua_tonumber(st, 2);
          const str = to_jsstring(lua.lua_tostring(st, 3));
          const color = to_jsstring(lua.lua_tostring(st, 4));
          ctx.fillStyle = color;
          ctx.font = "16px sans-serif";
          ctx.fillText(str, x, y);
          return 0;
        });
        lua.lua_setfield(L, -2, to_luastring("text"));
        lua.lua_pushcfunction(L, (st: any) => {
          // hydyar.loop(fn): register fn to call each frame with (time)
          if (lua.lua_isfunction(st, 1)) {
            lua.lua_pushvalue(st, 1);
            const ref = lua.luaL_ref(st, lua.LUA_REGISTRYINDEX);
            loopFns.push(ref);
          }
          return 0;
        });
        lua.lua_setfield(L, -2, to_luastring("loop"));
        lua.lua_setglobal(L, to_luastring("hydyar"));
      };
      pushHydyar();

      const setTimeGlobals = (t: number) => {
        lua.lua_getglobal(L, to_luastring("hydyar"));
        lua.lua_pushnumber(L, t);
        lua.lua_setfield(L, -2, to_luastring("time"));
        lua.lua_pushnumber(L, frame);
        lua.lua_setfield(L, -2, to_luastring("frame"));
        lua.lua_pop(L, 1);
      };

      const tick = () => {
        if (!alive) return;
        const t = (performance.now() - start) / 1000;
        frame++;
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.fillStyle = "#f7f5ff";
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        setTimeGlobals(t);
        // Re-run main body each frame so static marker shapes persist + time-dependent code animates
        const status = lauxlib.luaL_loadstring(L, to_luastring(code));
        if (status === lua.LUA_OK) {
          const pc = lua.lua_pcall(L, 0, 0, 0);
          if (pc !== lua.LUA_OK) {
            const err = to_jsstring(lua.lua_tostring(L, -1));
            if (alive) setError(err);
            lua.lua_pop(L, 1);
          } else if (alive) setError(null);
        }
        // Call registered loop fns with time arg
        for (const ref of loopFns) {
          lua.lua_rawgeti(L, lua.LUA_REGISTRYINDEX, ref);
          lua.lua_pushnumber(L, t);
          lua.lua_pcall(L, 1, 0, 0);
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    };
    run().catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, [code]);

  // Drag handlers on DOM scene
  const onPointerMove = (e: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (d.mode === "move") updateObj(d.id, { x: Math.round(d.ox + dx), y: Math.round(d.oy + dy) });
    else updateObj(d.id, { w: Math.max(8, d.ow + dx), h: Math.max(8, d.oh + dy) });
  };
  const onPointerUp = () => {
    dragRef.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  };
  const startDrag = (o: SceneObject, mode: "move" | "resize") => (e: React.PointerEvent) => {
    e.stopPropagation();
    setSelected(o.id);
    dragRef.current = { id: o.id, mode, sx: e.clientX, sy: e.clientY, ox: o.x, oy: o.y, ow: o.w, oh: o.h };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <h1 className="text-2xl font-black">Lua Graphics Studio</h1>
        <span className="chip">Fengari · Canvas 2D</span>
        <div className="flex-1" />
        <button className="btn-ghost !py-1.5 text-xs" onClick={syncCodeToScene}>⇆ Đồng bộ từ code</button>
      </div>
      <p className="text-muted text-sm mb-4">
        Thêm hình, kéo thả, chỉnh thuộc tính — khối marker <code className="font-mono bg-surface-2 px-1 rounded">-- hydyar:scene:begin/end</code> tự động sinh lại. Code thủ công bên ngoài được giữ nguyên.
      </p>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        <div className="space-y-4">
          {/* Visual scene editor (DOM) */}
          <div className="surface-card p-3">
            <div className="flex gap-2 mb-2 flex-wrap">
              <button className="btn-ghost !py-1.5 text-xs" onClick={() => addShape("rect")}>+ Hình chữ nhật</button>
              <button className="btn-ghost !py-1.5 text-xs" onClick={() => addShape("circle")}>+ Tròn</button>
              <button className="btn-ghost !py-1.5 text-xs" onClick={() => addShape("line")}>+ Đường thẳng</button>
              <button className="btn-ghost !py-1.5 text-xs" onClick={() => addShape("text")}>+ Văn bản</button>
              <button className="btn-ghost !py-1.5 text-xs !text-[var(--danger)]" onClick={removeSelected} disabled={selected == null}>✕ Xóa đã chọn</button>
            </div>
            <div
              ref={sceneRef}
              className="relative rounded-lg overflow-hidden border border-border mx-auto"
              style={{ width: CANVAS_W, maxWidth: "100%", height: CANVAS_H, background: "#f7f5ff", touchAction: "none" }}
              onPointerDown={() => setSelected(null)}
            >
              {objects.map((o) => {
                const isSel = o.id === selected;
                const base: React.CSSProperties = { position: "absolute", left: o.x, top: o.y, cursor: "move", outline: isSel ? "2px dashed var(--accent-purple)" : "none" };
                if (o.type === "rect") return <div key={o.id} style={{ ...base, width: o.w, height: o.h, background: o.color }} onPointerDown={startDrag(o, "move")}>{isSel && <ResizeHandle onDown={startDrag(o, "resize")} />}</div>;
                if (o.type === "circle") return <div key={o.id} style={{ ...base, width: o.w, height: o.h, background: o.color, borderRadius: "50%" }} onPointerDown={startDrag(o, "move")}>{isSel && <ResizeHandle onDown={startDrag(o, "resize")} />}</div>;
                if (o.type === "line") {
                  const len = Math.hypot(o.w, o.h) || 1;
                  const ang = Math.atan2(o.h, o.w) * 180 / Math.PI;
                  return <div key={o.id} style={{ ...base, width: len, height: 3, background: o.color, transform: `rotate(${ang}deg)`, transformOrigin: "0 50%" }} onPointerDown={startDrag(o, "move")} />;
                }
                return <div key={o.id} style={{ ...base, color: o.color, fontWeight: 600, whiteSpace: "nowrap" }} onPointerDown={startDrag(o, "move")}>{o.text}</div>;
              })}
            </div>
            <p className="text-[11px] text-muted mt-2 text-center">Kéo đối tượng để di chuyển · chọn rồi kéo góc dưới-phải để thay đổi kích thước</p>
          </div>

          {/* Code editor */}
          <div className="surface-card overflow-hidden">
            <div className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-muted border-b border-border">Code Lua (khối marker được đồng bộ tự động)</div>
            <div style={{ height: 280 }}>
              <Editor height="100%" language="lua" value={code} onChange={(v) => setCode(v ?? "")} theme={theme === "dark" ? "vs-dark" : "light"} options={{ fontSize: 13, minimap: { enabled: false }, automaticLayout: true }} />
            </div>
            {error && <div className="px-3 py-2 text-xs font-mono" style={{ color: "var(--danger)", background: "rgba(224,85,119,0.08)" }}>Lỗi Lua: {error}</div>}
          </div>
        </div>

        {/* Right: preview + property panel */}
        <div className="space-y-4">
          <div className="surface-card overflow-hidden">
            <div className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-muted border-b border-border">Xem trước (Fengari + vòng lặp hoạt hình)</div>
            <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} className="w-full block" style={{ background: "#f7f5ff" }} />
          </div>
          <div className="surface-card p-4">
            <h3 className="font-bold text-sm mb-3">Thuộc tính</h3>
            {!sel && <p className="text-xs text-muted">Chọn một đối tượng trong cảnh để chỉnh sửa.</p>}
            {sel && (
              <div className="space-y-2 text-xs">
                <Field label="Loại"><span className="chip">{sel.type}</span></Field>
                <Field label="X"><input type="number" className="input-field !py-1 !text-xs" value={sel.x} onChange={(e) => updateObj(sel.id, { x: +e.target.value })} /></Field>
                <Field label="Y"><input type="number" className="input-field !py-1 !text-xs" value={sel.y} onChange={(e) => updateObj(sel.id, { y: +e.target.value })} /></Field>
                {sel.type !== "line" && sel.type !== "text" && <Field label="Rộng"><input type="number" className="input-field !py-1 !text-xs" value={sel.w} onChange={(e) => updateObj(sel.id, { w: +e.target.value })} /></Field>}
                {sel.type === "rect" && <Field label="Cao"><input type="number" className="input-field !py-1 !text-xs" value={sel.h} onChange={(e) => updateObj(sel.id, { h: +e.target.value })} /></Field>}
                {sel.type === "text" && <Field label="Nội dung"><input className="input-field !py-1 !text-xs" value={sel.text ?? ""} onChange={(e) => updateObj(sel.id, { text: e.target.value })} /></Field>}
                <Field label="Màu"><input type="color" value={sel.color} onChange={(e) => updateObj(sel.id, { color: e.target.value })} className="w-full h-8 rounded border border-border" /></Field>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-muted block mb-0.5">{label}</span>
      {children}
    </label>
  );
}

function ResizeHandle({ onDown }: { onDown: (e: React.PointerEvent) => void }) {
  return (
    <div
      onPointerDown={onDown}
      className="absolute bottom-0 right-0 w-3 h-3 cursor-nwse-resize"
      style={{ background: "var(--accent-purple)" }}
      title="Kéo để thay đổi kích thước"
    />
  );
}
