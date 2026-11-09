import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import Editor, { loader } from "@monaco-editor/react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { api, ApiError } from "../lib/api";
import { runCode, buildPreviewSrcdoc, PREVIEW_LANGUAGES, type RunUpdate } from "../lib/execution";
import { useApp } from "../store/AppContext";
import type { ProjectDTO, ProjectFileDTO } from "@hydyar/shared";

// Configure monaco to load from CDN (keeps build simple, no worker bundling)
loader.config({ paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.0/min/vs" } });

function langFromPath(p: string): string {
  const ext = p.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    js: "javascript", mjs: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript",
    py: "python", lua: "lua", sql: "sql", html: "html", htm: "html", css: "css",
    c: "c", h: "c", cpp: "cpp", cc: "cpp", hpp: "cpp", php: "php",
    java: "java", go: "go", rs: "rust", sh: "shell", bash: "shell", json: "json", md: "markdown",
  };
  return map[ext] ?? "plaintext";
}

const PRESET_INFO: Record<string, { title: string; body: string; files: [string, string][] }> = {
  web: {
    title: "Môi trường Web (HTML/CSS/JS)",
    body: "Bạn đang ở chế độ Web. Tạo index.html, style.css, script.js — nhấn Run để xem kết quả trong khung Preview (iframe cách ly, sandbox allow-scripts).",
    files: [
      ["index.html", '<!doctype html>\n<html>\n<head><link rel="stylesheet" href="style.css"></head>\n<body>\n  <h1>Xin chào HydYar 👋</h1>\n  <button id="btn">Bấm tôi</button>\n  <script src="script.js"></script>\n</body>\n</html>'],
      ["style.css", "body { font-family: sans-serif; padding: 2rem; background: #eef3ff; }\nbutton { padding: .5rem 1rem; border-radius: 8px; border: none; background: linear-gradient(135deg,#6FA8FF,#8F7CFF); color: white; cursor: pointer; }"],
      ["script.js", 'document.getElementById("btn").addEventListener("click", () => {\n  alert("Bạn vừa bấm nút!");\n  console.log("click logged");\n});'],
    ],
  },
  server: {
    title: "Môi trường Server (Node.js)",
    body: "JavaScript/TypeScript chạy cục bộ trong Web Worker (không có API DOM/fs thật). Để chạy Node.js thật với filesystem/mạng, dùng máy chủ thực thi — hỗ trợ javascript/typescript/python.",
    files: [["server.js", '// Mô phỏng server đơn giản (chạy trong Worker, không nghe cổng thật)\nconst routes = { "/": "Xin chào từ HydYar server" };\nconsole.log("Đã đăng ký route:", Object.keys(routes));\nconsole.log("GET / →", routes["/"]);']],
  },
  termux: {
    title: "Lập trình trên Android (Termux)",
    body: "HydYar không chạy Termux thật. Đây là hướng dẫn: cài Termux từ F-Droid, chạy `pkg install nodejs python`, rồi code ở đây để thử nghiệm trước. Output hiển thị ở Terminal bên dưới.",
    files: [["hello.py", 'print("Xin chào từ Python trên Termux!")\nfor i in range(3):\n    print(f"  lần {i+1}: code ở đây, chạy trên điện thoại của bạn")']],
  },
  app: {
    title: "Khởi đầu ứng dụng di động",
    body: "Chưa có môi trường build app thật trên Render Free. Bạn có thể viết logic JS/TS và thử nhanh ở đây; build thật cần máy chủ riêng (hạn chế trung thực được ghi rõ).",
    files: [["app.js", '// Bản mẫu logic ứng dụng\nconst state = { count: 0 };\nfunction increment() { state.count++; console.log("count =", state.count); }\nincrement(); increment();']],
  },
  khac: {
    title: "IDE trống",
    body: "Tự do chọn ngôn ngữ. JS/TS/Python/Lua/SQL chạy cục bộ; các ngôn ngữ khác gửi tới máy chủ thực thi (nếu hỗ trợ) và báo cáo giới hạn trung thực.",
    files: [["main.js", 'console.log("Xin chào HydYar!");']],
  },
};

type MobileTab = "explorer" | "editor" | "terminal" | "output" | "preview";
type RightTab = "terminal" | "output" | "preview";

interface FileState {
  content: string;
  language: string;
}

export default function IDE() {
  const { projectId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, toast, theme } = useApp();

  const [files, setFiles] = useState<Record<string, FileState>>({});
  const [tabs, setTabs] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [project, setProject] = useState<ProjectDTO | null>(null);
  const [myProjects, setMyProjects] = useState<ProjectDTO[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [runStatus, setRunStatus] = useState<RunUpdate | null>(null);
  const [output, setOutput] = useState("");
  const [rightTab, setRightTab] = useState<RightTab>("output");
  const [mobileTab, setMobileTab] = useState<MobileTab>("editor");
  const [stdinLine, setStdinLine] = useState("");
  const [stdinBuf, setStdinBuf] = useState("");
  const [newFileName, setNewFileName] = useState("");
  const [showNewFile, setShowNewFile] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<string>("");
  const [previewKey, setPreviewKey] = useState(0);

  const termRef = useRef<HTMLDivElement>(null);
  const termInst = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);

  const preset = params.get("preset") ?? "khac";
  const presetLang = params.get("lang");
  const presetInfo = PRESET_INFO[preset] ?? PRESET_INFO.khac;

  // Load project or init preset
  useEffect(() => {
    let alive = true;
    if (projectId) {
      api<ProjectDTO & { files?: ProjectFileDTO[] }>(`/api/projects/${projectId}`)
        .then((p) => {
          if (!alive) return;
          setProject(p);
          const fs: Record<string, FileState> = {};
          for (const f of p.files ?? []) fs[f.path] = { content: f.content, language: f.language ?? langFromPath(f.path) };
          setFiles(fs);
          const first = Object.keys(fs)[0];
          if (first) { setTabs([first]); setActive(first); }
        })
        .catch((e) => toast(e instanceof ApiError ? e.message : "Không tải được dự án", "error"));
    } else {
      const fs: Record<string, FileState> = {};
      for (const [path, content] of presetInfo.files) fs[path] = { content, language: presetLang ?? langFromPath(path) };
      setFiles(fs);
      const first = Object.keys(fs)[0];
      if (first) { setTabs([first]); setActive(first); }
    }
    if (user) api<ProjectDTO[]>("/api/projects").then(setMyProjects).catch(() => setMyProjects([]));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, preset]);

  // xterm init
  useEffect(() => {
    if (!termRef.current || termInst.current) return;
    const term = new Terminal({
      theme: theme === "dark" ? { background: "#0f0e24", foreground: "#eceaff" } : { background: "#1e1b3a", foreground: "#eceaff" },
      fontSize: 13,
      convertEol: true,
      scrollback: 2000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(termRef.current);
    setTimeout(() => fit.fit(), 50);
    term.writeln("\x1b[90mTerminal (output + stdin) — không phải shell thật trên Render Free.\x1b[0m");
    term.writeln("\x1b[90mOutput của lệnh chạy hiển thị ở đây. Gõ stdin ở ô dưới rồi Enter.\x1b[0m");
    termInst.current = term;
    fitAddon.current = fit;
    const onResize = () => fit.fit();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [theme]);

  const termWrite = useCallback((s: string) => {
    termInst.current?.write(s.replace(/\n/g, "\r\n"));
  }, []);

  const setFileContent = (path: string, content: string) => {
    setFiles((f) => ({ ...f, [path]: { ...f[path], content } }));
    setDirty((d) => new Set(d).add(path));
  };

  const openTab = (path: string) => {
    if (!tabs.includes(path)) setTabs([...tabs, path]);
    setActive(path);
    setMobileTab("editor");
  };
  const closeTab = (path: string) => {
    const nt = tabs.filter((t) => t !== path);
    setTabs(nt);
    if (active === path) setActive(nt[nt.length - 1] ?? null);
  };

  const createFile = () => {
    const name = newFileName.trim();
    if (!name) return;
    if (files[name]) { toast("File đã tồn tại", "error"); return; }
    setFiles((f) => ({ ...f, [name]: { content: "", language: presetLang ?? langFromPath(name) } }));
    setDirty((d) => new Set(d).add(name));
    openTab(name);
    setNewFileName("");
    setShowNewFile(false);
  };

  const deleteFile = async (path: string) => {
    if (!confirm(`Xóa file "${path}"?`)) return;
    if (project) {
      try {
        await api(`/api/projects/${project.id}/files?path=${encodeURIComponent(path)}`, { method: "DELETE" });
      } catch (e) {
        toast(e instanceof ApiError ? e.message : "Xóa thất bại", "error");
        return;
      }
    }
    setFiles((f) => { const n = { ...f }; delete n[path]; return n; });
    closeTab(path);
    toast("Đã xóa", "success");
  };

  const renameFile = async (path: string) => {
    const newName = prompt("Tên mới:", path);
    if (!newName || newName === path) return;
    if (files[newName]) { toast("Đã tồn tại file tên đó", "error"); return; }
    const content = files[path].content;
    if (project) {
      try {
        await api(`/api/projects/${project.id}/files`, { method: "PUT", body: { path: newName, content, language: files[path].language } });
        await api(`/api/projects/${project.id}/files?path=${encodeURIComponent(path)}`, { method: "DELETE" });
      } catch (e) {
        toast(e instanceof ApiError ? e.message : "Đổi tên thất bại", "error");
        return;
      }
    }
    setFiles((f) => { const n = { ...f }; n[newName] = f[path]; delete n[path]; return n; });
    setTabs((t) => t.map((x) => (x === path ? newName : x)));
    if (active === path) setActive(newName);
  };

  const save = async () => {
    if (!user) { toast("Đăng nhập để lưu dự án lên máy chủ (hiện chỉ lưu cục bộ)", "info"); return; }
    setSaving(true);
    try {
      let proj = project;
      if (!proj) {
        proj = await api<ProjectDTO>("/api/projects", {
          method: "POST",
          body: { name: `${presetInfo.title} ${new Date().toLocaleTimeString("vi-VN")}`, language: active ? langFromPath(active) : "javascript" },
        });
        setProject(proj);
        navigate(`/ide/${proj.id}`, { replace: true });
      }
      for (const path of Object.keys(files)) {
        await api(`/api/projects/${proj.id}/files`, { method: "PUT", body: { path, content: files[path].content, language: files[path].language } });
      }
      setDirty(new Set());
      toast("Đã lưu dự án", "success");
      if (user) api<ProjectDTO[]>("/api/projects").then(setMyProjects).catch(() => {});
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Lưu thất bại", "error");
    } finally {
      setSaving(false);
    }
  };

  const run = async () => {
    if (!active) { toast("Chọn một file để chạy", "info"); return; }
    const file = files[active];
    const language = file.language === "plaintext" ? langFromPath(active) : file.language;
    setRunning(true);
    setOutput("");
    setRightTab("output");
    setMobileTab("output");
    termWrite(`\r\n\x1b[36m$ run ${active} (${language})\x1b[0m\r\n`);

    if (PREVIEW_LANGUAGES.has(language) || active.endsWith(".html") || Object.keys(files).some((p) => p.endsWith(".html"))) {
      const doc = buildPreviewSrcdoc(Object.entries(files).map(([path, f]) => ({ path, content: f.content })));
      setPreviewDoc(doc);
      setPreviewKey((k) => k + 1);
      setRightTab("preview");
      setMobileTab("preview");
      setRunStatus({ status: "success", message: "Đã render trong khung Preview (iframe sandbox)." });
      termWrite("\x1b[32m→ Đã mở khung Preview.\x1b[0m\r\n");
      setRunning(false);
      return;
    }

    try {
      const result = await runCode({ language, code: file.content, stdin: stdinBuf }, (u) => {
        setRunStatus(u);
        if (u.message) termWrite(`\x1b[90m${u.message}\x1b[0m\r\n`);
      });
      if (result.stdout) { setOutput((o) => o + result.stdout + "\n"); termWrite(result.stdout + "\r\n"); }
      if (result.stderr) { setOutput((o) => o + result.stderr + "\n"); termWrite(`\x1b[31m${result.stderr}\x1b[0m\r\n`); }
      if (result.status === "unsupported") {
        termWrite(`\x1b[33m${result.message ?? "Ngôn ngữ này không hỗ trợ thực thi."}\x1b[0m\r\n`);
      }
      termWrite(`\x1b[90m— hoàn thành (${result.runtime ?? "?"}, ${result.durationMs ?? 0}ms, status=${result.status})\x1b[0m\r\n`);
      setRunStatus({ status: result.status, message: result.message, stdout: result.stdout, stderr: result.stderr });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setOutput((o) => o + "LỖI: " + msg + "\n");
      termWrite(`\x1b[31mLỖI: ${msg}\x1b[0m\r\n`);
      setRunStatus({ status: "error", message: msg });
    } finally {
      setRunning(false);
    }
  };

  const sendStdin = () => {
    const line = stdinLine + "\n";
    setStdinBuf((b) => b + line);
    termWrite(`\x1b[36m<stdin> ${stdinLine}\x1b[0m\r\n`);
    setStdinLine("");
  };

  const fileList = useMemo(() => Object.keys(files).sort(), [files]);
  const activeLang = active ? files[active]?.language ?? langFromPath(active) : "plaintext";

  const rightPanel = (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-1 px-2 py-1 border-b border-border shrink-0" style={{ background: "var(--surface-2)" }}>
        {(["terminal", "output", "preview"] as RightTab[]).map((t) => (
          <button key={t} onClick={() => setRightTab(t)} className={`px-3 py-1 rounded text-xs font-medium ${rightTab === t ? "brand-gradient text-white" : "text-muted hover:text-ink"}`}>
            {t === "terminal" ? "Terminal" : t === "output" ? "Output" : "Preview"}
          </button>
        ))}
        <div className="flex-1" />
        {runStatus && <span className="text-[10px] text-muted truncate max-w-[40%]">{runStatus.status}{runStatus.message ? ` — ${runStatus.message}` : ""}</span>}
      </div>
      <div className="flex-1 min-h-0" style={{ display: rightTab === "terminal" ? "flex" : "block", flexDirection: "column" }}>
        {rightTab === "terminal" && (
          <>
            <div ref={termRef} className="flex-1 min-h-0 p-1" style={{ background: "var(--code-bg)" }} />
            <div className="flex gap-2 p-2 border-t border-border shrink-0" style={{ background: "var(--surface-2)" }}>
              <input
                className="input-field !py-1.5 text-sm font-mono flex-1"
                placeholder="stdin (Enter để gửi cho lần chạy sau)…"
                value={stdinLine}
                onChange={(e) => setStdinLine(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") sendStdin(); }}
              />
              <button className="btn-ghost !py-1 text-xs" onClick={sendStdin}>Gửi stdin</button>
            </div>
          </>
        )}
        {rightTab === "output" && (
          <pre className="h-full overflow-auto p-3 text-xs font-mono whitespace-pre-wrap" style={{ background: "var(--code-bg)", color: "#eceaff", margin: 0 }}>
            {output || "(chưa có output — nhấn Run)"}
          </pre>
        )}
        {rightTab === "preview" && (
          previewDoc ? (
            <iframe key={previewKey} title="preview" sandbox="allow-scripts" srcDoc={previewDoc} className="w-full h-full bg-white" style={{ border: 0 }} />
          ) : (
            <div className="p-4 text-sm text-muted">Chạy dự án HTML/CSS/JS để xem preview tại đây.</div>
          )
        )}
      </div>
    </div>
  );

  const explorer = (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between shrink-0">
        <span className="text-xs font-bold uppercase tracking-wider text-muted">Explorer</span>
        <button className="text-accent-purple text-sm font-bold" onClick={() => setShowNewFile((v) => !v)} title="Tạo file">+ File</button>
      </div>
      {showNewFile && (
        <div className="p-2 border-b border-border flex gap-1 shrink-0">
          <input className="input-field !py-1 text-xs flex-1" placeholder="path/file.js" value={newFileName} onChange={(e) => setNewFileName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createFile()} autoFocus />
          <button className="btn-ghost !py-1 !px-2 text-xs" onClick={createFile}>OK</button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {fileList.length === 0 && <p className="text-xs text-muted p-2">Chưa có file. Nhấn + File.</p>}
        {fileList.map((p) => (
          <div key={p} className={`group flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer ${active === p ? "bg-surface-2 font-semibold" : "hover:bg-surface-2"}`} onClick={() => openTab(p)}>
            <span className="text-muted">▸</span>
            <span className="flex-1 truncate font-mono">{p}</span>
            {dirty.has(p) && <span className="text-[var(--warning)]">●</span>}
            <button className="opacity-0 group-hover:opacity-100 text-muted hover:text-ink px-1" onClick={(e) => { e.stopPropagation(); renameFile(p); }} title="Đổi tên">✎</button>
            <button className="opacity-0 group-hover:opacity-100 text-muted hover:text-[var(--danger)] px-1" onClick={(e) => { e.stopPropagation(); deleteFile(p); }} title="Xóa">✕</button>
          </div>
        ))}
      </div>
      {user && (
        <div className="border-t border-border p-2 shrink-0 max-h-40 overflow-y-auto">
          <div className="text-[10px] font-bold uppercase text-muted mb-1 px-1">Dự án của tôi</div>
          {myProjects === null && <div className="text-[10px] text-muted px-1">…</div>}
          {myProjects?.map((pr) => (
            <Link key={pr.id} to={`/ide/${pr.id}`} className={`block px-2 py-1 rounded text-xs truncate hover:bg-surface-2 ${project?.id === pr.id ? "font-semibold text-accent-purple" : ""}`}>
              {pr.name}
            </Link>
          ))}
          {myProjects && myProjects.length === 0 && <div className="text-[10px] text-muted px-1">Chưa có — nhấn Lưu để tạo.</div>}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] lg:h-[calc(100vh-64px)] -m-3 sm:-m-5 lg:-m-8">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0 flex-wrap" style={{ background: "var(--surface)" }}>
        <span className="font-bold text-sm brand-text">IDE</span>
        <span className="chip !text-[10px]">{project ? project.name : `Chưa lưu · ${preset}`}</span>
        {dirty.size > 0 && <span className="text-xs text-[var(--warning)]">● {dirty.size} thay đổi chưa lưu</span>}
        <div className="flex-1" />
        <button className="btn-ghost !py-1.5 text-xs" onClick={save} disabled={saving}>{saving ? "Đang lưu…" : "💾 Lưu"}</button>
        <button className="btn-primary !py-1.5 text-xs" onClick={run} disabled={running}>
          {running ? "⏳ Đang chạy…" : "▶ Run"}
        </button>
      </div>

      {/* Preset info banner */}
      {!projectId && (
        <div className="px-3 py-2 text-xs border-b border-border shrink-0" style={{ background: "rgba(143,124,255,0.08)" }}>
          <b>{presetInfo.title}:</b> {presetInfo.body}
        </div>
      )}
      {!user && (
        <div className="px-3 py-1.5 text-[11px] border-b border-border shrink-0" style={{ background: "rgba(232,163,61,0.1)", color: "var(--warning)" }}>
          Chưa đăng nhập — code chỉ lưu trong trình duyệt. <Link to="/login" className="underline">Đăng nhập</Link> để lưu dự án.
        </div>
      )}

      {/* Desktop/tablet layout */}
      <div className="hidden md:flex flex-1 min-h-0">
        <div className="w-56 shrink-0 border-r border-border" style={{ background: "var(--surface)" }}>{explorer}</div>
        <div className="flex-1 flex flex-col min-w-0">
          {/* Tabs */}
          <div className="flex items-center gap-0.5 px-1 py-1 border-b border-border overflow-x-auto shrink-0" style={{ background: "var(--surface-2)" }}>
            {tabs.map((t) => (
              <div key={t} className={`flex items-center gap-1 px-2.5 py-1 rounded-t text-xs cursor-pointer whitespace-nowrap ${active === t ? "bg-surface font-semibold" : "text-muted hover:text-ink"}`} onClick={() => setActive(t)}>
                <span className="font-mono">{t.split("/").pop()}</span>
                <button className="opacity-60 hover:opacity-100" onClick={(e) => { e.stopPropagation(); closeTab(t); }}>✕</button>
              </div>
            ))}
            {tabs.length === 0 && <span className="text-xs text-muted px-2">Không có tab nào mở</span>}
          </div>
          <div className="flex-1 min-h-0 grid" style={{ gridTemplateRows: "1.4fr 1fr" }}>
            <div className="min-h-0 border-b border-border">
              {active ? (
                <Editor
                  height="100%"
                  language={activeLang === "shell" ? "shell" : activeLang}
                  value={files[active]?.content ?? ""}
                  onChange={(v) => setFileContent(active, v ?? "")}
                  theme={theme === "dark" ? "vs-dark" : "light"}
                  loading={<div className="p-4 text-sm text-muted">Đang tải Monaco (CDN)…</div>}
                  options={{ fontSize: 13, minimap: { enabled: false }, automaticLayout: true, scrollBeyondLastLine: false }}
                />
              ) : <div className="p-6 text-muted text-sm">Mở một file từ Explorer để bắt đầu.</div>}
            </div>
            <div className="min-h-0">{rightPanel}</div>
          </div>
        </div>
      </div>

      {/* Mobile layout: tab bar switching panes (NOT shrunk desktop) */}
      <div className="md:hidden flex-1 flex flex-col min-h-0">
        <div className="flex-1 min-h-0 overflow-hidden">
          {mobileTab === "explorer" && <div className="h-full" style={{ background: "var(--surface)" }}>{explorer}</div>}
          {mobileTab === "editor" && (
            <div className="h-full flex flex-col">
              <div className="flex gap-0.5 px-1 py-1 border-b border-border overflow-x-auto shrink-0" style={{ background: "var(--surface-2)" }}>
                {tabs.map((t) => (
                  <div key={t} className={`px-2 py-1 rounded text-xs ${active === t ? "bg-surface font-semibold" : "text-muted"}`} onClick={() => setActive(t)}>{t.split("/").pop()}</div>
                ))}
              </div>
              <div className="flex-1 min-h-0">
                {active ? (
                  <Editor height="100%" language={activeLang} value={files[active]?.content ?? ""} onChange={(v) => setFileContent(active, v ?? "")} theme={theme === "dark" ? "vs-dark" : "light"} options={{ fontSize: 13, minimap: { enabled: false }, automaticLayout: true }} />
                ) : <div className="p-4 text-sm text-muted">Chọn tab Explorer để mở file.</div>}
              </div>
            </div>
          )}
          {(mobileTab === "terminal" || mobileTab === "output" || mobileTab === "preview") && <div className="h-full flex flex-col">{rightPanel}</div>}
        </div>
        <div className="flex border-t border-border shrink-0" style={{ background: "var(--surface)" }}>
          {(["explorer", "editor", "terminal", "output", "preview"] as MobileTab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setMobileTab(t); if (t === "terminal" || t === "output" || t === "preview") setRightTab(t); }}
              className={`flex-1 py-2 text-[10px] font-medium ${mobileTab === t ? "brand-gradient text-white" : "text-muted"}`}
            >
              {t === "explorer" ? "Explorer" : t === "editor" ? "Editor" : t === "terminal" ? "Terminal" : t === "output" ? "Output" : "Preview"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
