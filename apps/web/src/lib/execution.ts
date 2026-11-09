import { api } from "./api";
import type { ExecuteResponse, ExecuteRequest } from "@hydyar/shared";

export type RunStatus = "loading-runtime" | "queued" | "running" | "success" | "error" | "timeout" | "killed" | "unsupported";
export interface RunUpdate {
  status: RunStatus;
  message?: string;
  stdout?: string;
  stderr?: string;
}

const PYODIDE_CDN = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";
const SQLJS_CDN = "https://cdn.jsdelivr.net/npm/sql.js@1.12.0/dist/";
const TS_CDN = "https://cdn.jsdelivr.net/npm/typescript@5.6.3/lib/typescript.js";

let pyodidePromise: Promise<any> | null = null;
let sqljsPromise: Promise<any> | null = null;
let tsPromise: Promise<any> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Không tải được ${src}`));
    document.head.appendChild(s);
  });
}

async function loadPyodideRuntime(onStatus: (u: RunUpdate) => void): Promise<any> {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      onStatus({ status: "loading-runtime", message: "Đang tải Pyodide (khoảng 10MB, chỉ tải một lần)…" });
      await loadScript(PYODIDE_CDN + "pyodide.js");
      if (!window.loadPyodide) throw new Error("loadPyodide không khả dụng sau khi tải script.");
      const py = await window.loadPyodide({ indexURL: PYODIDE_CDN });
      return py;
    })();
  }
  return pyodidePromise;
}

async function loadSqlJs(onStatus: (u: RunUpdate) => void): Promise<any> {
  if (!sqljsPromise) {
    sqljsPromise = (async () => {
      onStatus({ status: "loading-runtime", message: "Đang tải sql.js (WebAssembly)…" });
      await loadScript(SQLJS_CDN + "sql-wasm.js");
      if (!window.initSqlJs) throw new Error("initSqlJs không khả dụng.");
      return window.initSqlJs({ locateFile: (f: string) => SQLJS_CDN + f });
    })();
  }
  return sqljsPromise;
}

async function loadTs(onStatus: (u: RunUpdate) => void): Promise<any> {
  if (!tsPromise) {
    tsPromise = (async () => {
      onStatus({ status: "loading-runtime", message: "Đang tải trình biên dịch TypeScript…" });
      await loadScript(TS_CDN);
      if (!window.ts) throw new Error("TypeScript compiler không khả dụng.");
      return window.ts;
    })();
  }
  return tsPromise;
}

// ===== JS/TS in Web Worker (sandboxed) =====
const WORKER_SRC = `
self.onmessage = (e) => {
  const { code, stdin } = e.data;
  const logs = [];
  const errs = [];
  const push = (arr) => (...args) => arr.push(args.map(a => {
    try { return typeof a === 'string' ? a : (a instanceof Error ? (a.stack || String(a)) : JSON.stringify(a)); } catch { return String(a); }
  }).join(' '));
  const console = { log: push(logs), error: push(errs), warn: push(logs), info: push(logs), debug: push(logs) };
  const __stdin__ = stdin || '';
  const start = performance.now();
  (async () => {
    try {
      const fn = new Function('console', '__stdin__', '"use strict";\\nreturn (async () => {\\n' + code + '\\n})();');
      await fn(console, __stdin__);
      self.postMessage({ ok: true, stdout: logs.join('\\n'), stderr: errs.join('\\n'), durationMs: Math.round(performance.now() - start) });
    } catch (err) {
      self.postMessage({ ok: false, stdout: logs.join('\\n'), stderr: (errs.length ? errs.join('\\n') + '\\n' : '') + (err && err.stack ? err.stack : String(err)), durationMs: Math.round(performance.now() - start) });
    }
  })();
};
`;

function runJsInWorker(code: string, stdin: string, timeoutMs = 8000): Promise<{ stdout: string; stderr: string; durationMs: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: "application/javascript" }));
    const worker = new Worker(url);
    const timer = setTimeout(() => {
      worker.terminate();
      URL.revokeObjectURL(url);
      reject(new Error(`Timeout sau ${timeoutMs}ms. Vòng lặp vô hạn hoặc tính toán quá nặng.`));
    }, timeoutMs);
    worker.onmessage = (e) => {
      clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve({ stdout: e.data.stdout ?? "", stderr: e.data.stderr ?? "", durationMs: e.data.durationMs ?? 0 });
    };
    worker.onerror = (e) => {
      clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      reject(new Error(e.message || "Lỗi Worker không xác định"));
    };
    worker.postMessage({ code, stdin });
  });
}

async function runLocal(language: string, code: string, stdin: string, onStatus: (u: RunUpdate) => void): Promise<ExecuteResponse> {
  const t0 = performance.now();
  if (language === "javascript" || language === "typescript") {
    let jsCode = code;
    if (language === "typescript") {
      const ts = await loadTs(onStatus);
      const out = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
      jsCode = out.outputText;
    }
    onStatus({ status: "running", message: "Đang chạy trong Web Worker (cục bộ, an toàn)…" });
    const r = await runJsInWorker(jsCode, stdin);
    return { runId: `local-${Date.now()}`, status: r.stderr ? "success" : "success", stdout: r.stdout, stderr: r.stderr, durationMs: r.durationMs, runtime: "local" };
  }

  if (language === "python") {
    const py = await loadPyodideRuntime(onStatus);
    onStatus({ status: "running", message: "Đang chạy Python (Pyodide/WASM cục bộ)…" });
    const stdout: string[] = [];
    const stderr: string[] = [];
    py.setStdout({ batched: (s: string) => stdout.push(s) });
    py.setStderr({ batched: (s: string) => stderr.push(s) });
    try {
      await py.runPythonAsync(`
import sys, io
sys.stdin = io.StringIO(${JSON.stringify(stdin)})
${code}
`);
    } catch (e: any) {
      return { runId: `local-${Date.now()}`, status: "error", stdout: stdout.join("\n"), stderr: stderr.join("\n") + (e?.message ? "\n" + String(e.message) : ""), durationMs: Math.round(performance.now() - t0), runtime: "local" };
    }
    return { runId: `local-${Date.now()}`, status: "success", stdout: stdout.join("\n"), stderr: stderr.join("\n"), durationMs: Math.round(performance.now() - t0), runtime: "local" };
  }

  if (language === "lua") {
    onStatus({ status: "running", message: "Đang chạy Lua (Fengari/WebAssembly cục bộ)…" });
    const fengari = await import("fengari-web");
    const { lua, lauxlib, lualib, to_jsstring } = fengari;
    const L = lauxlib.luaL_newstate();
    lualib.luaL_openlibs(L);
    const out: string[] = [];
    const printFn = (Lstate: any) => {
      const n = lua.lua_gettop(Lstate);
      const parts: string[] = [];
      for (let i = 1; i <= n; i++) {
        parts.push(to_jsstring(lua.luaL_tolstring(Lstate, i)));
        lua.lua_pop(Lstate, 1);
      }
      out.push(parts.join("\t"));
      return 0;
    };
    lua.lua_pushcfunction(L, printFn);
    lua.lua_setglobal(L, fengari.to_luastring("print"));
    const status = lauxlib.luaL_loadstring(L, fengari.to_luastring(code));
    if (status !== lua.LUA_OK) {
      const err = to_jsstring(lua.lua_tostring(L, -1));
      return { runId: `local-${Date.now()}`, status: "error", stdout: out.join("\n"), stderr: err, durationMs: Math.round(performance.now() - t0), runtime: "local" };
    }
    const pcallStatus = lua.lua_pcall(L, 0, 0, 0);
    if (pcallStatus !== lua.LUA_OK) {
      const err = to_jsstring(lua.lua_tostring(L, -1));
      return { runId: `local-${Date.now()}`, status: "error", stdout: out.join("\n"), stderr: err, durationMs: Math.round(performance.now() - t0), runtime: "local" };
    }
    return { runId: `local-${Date.now()}`, status: "success", stdout: out.join("\n"), stderr: "", durationMs: Math.round(performance.now() - t0), runtime: "local" };
  }

  if (language === "sql") {
    const SQL = await loadSqlJs(onStatus);
    onStatus({ status: "running", message: "Đang chạy SQLite (sql.js/WASM cục bộ)…" });
    const db = new SQL.Database();
    try {
      const results = db.exec(code);
      const lines: string[] = [];
      for (const r of results) {
        lines.push(r.columns.join(" | "));
        lines.push(r.columns.map(() => "---").join("-+-"));
        for (const row of r.values) lines.push(row.join(" | "));
        lines.push(`(${r.values.length} hàng)`);
      }
      return { runId: `local-${Date.now()}`, status: "success", stdout: lines.join("\n") || "(Không có kết quả — truy vấn đã thực thi)", stderr: "", durationMs: Math.round(performance.now() - t0), runtime: "local" };
    } catch (e: any) {
      return { runId: `local-${Date.now()}`, status: "error", stdout: "", stderr: String(e?.message ?? e), durationMs: Math.round(performance.now() - t0), runtime: "local" };
    } finally {
      db.close();
    }
  }

  throw new Error("LOCAL_UNSUPPORTED");
}

export const LOCAL_RUNNABLE = new Set(["javascript", "typescript", "python", "lua", "sql"]);
export const PREVIEW_LANGUAGES = new Set(["html", "css"]);

/**
 * Main entry: run code. Local-first; falls back to server POST /api/execute + poll.
 * Never fakes output. onStatus reports loading/queued/running progress.
 */
export async function runCode(
  req: { language: string; code: string; stdin?: string },
  onStatus: (u: RunUpdate) => void
): Promise<ExecuteResponse> {
  const stdin = req.stdin ?? "";
  if (LOCAL_RUNNABLE.has(req.language)) {
    try {
      return await runLocal(req.language, req.code, stdin, onStatus);
    } catch (e: any) {
      if (e?.message === "LOCAL_UNSUPPORTED") throw e;
      // Local runtime failed (e.g. CDN blocked) — fall back to server if capable
      if (["javascript", "typescript", "python"].includes(req.language)) {
        onStatus({ status: "queued", message: `Chạy cục bộ lỗi (${e?.message ?? "unknown"}), chuyển sang máy chủ…` });
        return runServer(req, onStatus);
      }
      throw e;
    }
  }
  return runServer(req, onStatus);
}

async function runServer(req: { language: string; code: string; stdin?: string }, onStatus: (u: RunUpdate) => void): Promise<ExecuteResponse> {
  onStatus({ status: "queued", message: "Đang gửi tới máy chủ thực thi…" });
  const body: ExecuteRequest = { language: req.language, code: req.code, stdin: req.stdin };
  const accepted = await api<{ runId: string; status: string; message?: string }>("/api/execute", { method: "POST", body });
  onStatus({ status: "queued", message: accepted.message ?? `Đã xếp hàng (runId=${accepted.runId})…` });
  const runId = accepted.runId;
  // Poll
  const start = Date.now();
  while (Date.now() - start < 60000) {
    await new Promise((r) => setTimeout(r, 700));
    const r = await api<ExecuteResponse>(`/api/execute/${runId}`);
    if (["success", "error", "timeout", "killed", "unsupported"].includes(r.status)) {
      onStatus({ status: r.status as RunStatus, message: r.message, stdout: r.stdout, stderr: r.stderr });
      return r;
    }
    onStatus({ status: r.status as RunStatus, message: r.message });
  }
  return { runId, status: "timeout", message: "Hết thời gian chờ kết quả từ máy chủ (60s).", runtime: "server" };
}

/** Build preview srcdoc for HTML/CSS/JS multi-file projects. */
export function buildPreviewSrcdoc(files: { path: string; content: string }[]): string {
  const html = files.find((f) => /\.html?$/i.test(f.path))?.content ?? "<!doctype html><html><body><div id='app'></div></body></html>";
  const css = files.filter((f) => /\.css$/i.test(f.path)).map((f) => f.content).join("\n");
  const js = files.filter((f) => /\.(js|mjs|ts)$/i.test(f.path)).map((f) => f.content).join("\n;\n");
  const withStyle = html.includes("</head>")
    ? html.replace("</head>", `<style>${css}</style></head>`)
    : html + `<style>${css}</style>`;
  const withScript = withStyle.includes("</body>")
    ? withStyle.replace("</body>", `<script>try{${js}}catch(e){document.body.insertAdjacentHTML('beforeend','<pre style=color:red>'+e+'</pre>')}<\/script></body>`)
    : withStyle + `<script>try{${js}}catch(e){console.error(e)}<\/script>`;
  return withScript;
}
