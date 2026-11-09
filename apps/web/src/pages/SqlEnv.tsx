import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { useApp } from "../store/AppContext";

const SQLJS_CDN = "https://cdn.jsdelivr.net/npm/sql.js@1.12.0/dist/";

const SEED_SQL = `
CREATE TABLE hoc_vien (
  id INTEGER PRIMARY KEY,
  ten TEXT NOT NULL,
  email TEXT UNIQUE,
  ngay_dang_ky TEXT
);
CREATE TABLE khoa_hoc (
  id INTEGER PRIMARY KEY,
  ten TEXT NOT NULL,
  ngon_ngu TEXT,
  muc_hoc_phi INTEGER
);
CREATE TABLE dang_ky (
  hoc_vien_id INTEGER,
  khoa_hoc_id INTEGER,
  ngay_dang_ky TEXT,
  PRIMARY KEY (hoc_vien_id, khoa_hoc_id)
);
INSERT INTO hoc_vien VALUES (1, 'Nguyễn Văn An', 'an@example.com', '2025-01-12');
INSERT INTO hoc_vien VALUES (2, 'Trần Thị Bình', 'binh@example.com', '2025-02-03');
INSERT INTO hoc_vien VALUES (3, 'Lê Minh Cường', 'cuong@example.com', '2025-02-20');
INSERT INTO hoc_vien VALUES (4, 'Phạm Thu Dung', 'dung@example.com', '2025-03-05');
INSERT INTO khoa_hoc VALUES (1, 'Lộ trình JavaScript', 'javascript', 0);
INSERT INTO khoa_hoc VALUES (2, 'Python căn bản', 'python', 0);
INSERT INTO khoa_hoc VALUES (3, 'SQL từ zero', 'sql', 0);
INSERT INTO dang_ky VALUES (1, 1, '2025-01-15');
INSERT INTO dang_ky VALUES (1, 3, '2025-02-01');
INSERT INTO dang_ky VALUES (2, 2, '2025-02-10');
INSERT INTO dang_ky VALUES (3, 1, '2025-02-25');
INSERT INTO dang_ky VALUES (3, 2, '2025-03-01');
INSERT INTO dang_ky VALUES (4, 3, '2025-03-10');
`;

const DEFAULT_QUERY = "-- Thử: SELECT hv.ten, kh.ten AS khoa_hoc\n-- FROM dang_ky dk JOIN hoc_vien hv ON hv.id = dk.hoc_vien_id\n-- JOIN khoa_hoc kh ON kh.id = dk.khoa_hoc_id;\nSELECT * FROM hoc_vien;";

interface QueryResult {
  columns: string[];
  values: unknown[][];
}

export default function SqlEnv() {
  const { toast, theme } = useApp();
  const [sql, setSql] = useState(DEFAULT_QUERY);
  const [results, setResults] = useState<QueryResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const dbRef = useRef<any>(null);
  const SQLRef = useRef<any>(null);

  const seed = async (SQL: any) => {
    const db = new SQL.Database();
    db.run(SEED_SQL);
    dbRef.current = db;
  };

  const ensureRuntime = async () => {
    if (SQLRef.current) return SQLRef.current;
    setLoading(true);
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SQLJS_CDN + "sql-wasm.js";
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Không tải được sql.js"));
      document.head.appendChild(s);
    });
    if (!window.initSqlJs) throw new Error("initSqlJs không khả dụng");
    const SQL = await window.initSqlJs({ locateFile: (f: string) => SQLJS_CDN + f });
    SQLRef.current = SQL;
    await seed(SQL);
    setRuntimeReady(true);
    setLoading(false);
    return SQL;
  };

  useEffect(() => {
    ensureRuntime().catch((e) => {
      setError(e instanceof Error ? e.message : "Lỗi tải sql.js");
      setLoading(false);
    });
  }, []);

  const run = async () => {
    setError(null);
    setResults(null);
    setLoading(true);
    try {
      const SQL = await ensureRuntime();
      void SQL;
      const db = dbRef.current;
      const out = db.exec(sql);
      setResults(out);
      if (out.length === 0) toast("Truy vấn đã chạy (không trả về hàng nào).", "success");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const reset = async () => {
    try {
      const SQL = await ensureRuntime();
      dbRef.current?.close?.();
      await seed(SQL);
      setResults(null);
      setError(null);
      toast("Đã đặt lại môi trường về CSDL mẫu.", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Đặt lại thất bại", "error");
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <h1 className="text-2xl font-black">SQL Playground</h1>
        <span className="chip">SQLite · sql.js (WASM cục bộ)</span>
        {runtimeReady && <span className="chip !text-[var(--success)]">● Đã sẵn sàng</span>}
      </div>
      <p className="text-muted text-sm mb-4">CSDL mẫu có 3 bảng: <code className="font-mono bg-surface-2 px-1 rounded">hoc_vien</code>, <code className="font-mono bg-surface-2 px-1 rounded">khoa_hoc</code>, <code className="font-mono bg-surface-2 px-1 rounded">dang_ky</code>. Viết truy vấn, nhấn Chạy.</p>

      <div className="flex gap-2 mb-3 flex-wrap">
        <button className="btn-primary !py-2 text-sm" onClick={run} disabled={loading}>{loading ? "Đang chạy…" : "▶ Chạy truy vấn"}</button>
        <button className="btn-ghost !py-2 text-sm" onClick={reset}>↺ Đặt lại môi trường</button>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="surface-card overflow-hidden">
          <div className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-muted border-b border-border">Trình soạn thảo SQL</div>
          <div style={{ height: 320 }}>
            <Editor
              height="100%"
              language="sql"
              value={sql}
              onChange={(v) => setSql(v ?? "")}
              theme={theme === "dark" ? "vs-dark" : "light"}
              options={{ fontSize: 13, minimap: { enabled: false }, automaticLayout: true }}
            />
          </div>
        </div>
        <div className="surface-card overflow-hidden flex flex-col" style={{ minHeight: 320 }}>
          <div className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-muted border-b border-border">Kết quả</div>
          <div className="flex-1 overflow-auto p-3">
            {error && (
              <div className="p-3 rounded-lg text-sm font-mono whitespace-pre-wrap" style={{ background: "rgba(224,85,119,0.12)", color: "var(--danger)" }}>
                LỖI: {error}
              </div>
            )}
            {!error && results === null && <p className="text-sm text-muted">{loading ? "Đang chạy…" : "Kết quả hiển thị ở đây."}</p>}
            {results?.map((r, i) => (
              <div key={i} className="mb-4 overflow-x-auto">
                <table className="text-xs border-collapse w-full">
                  <thead>
                    <tr>{r.columns.map((c) => <th key={c} className="text-left p-2 border border-border bg-surface-2 font-bold">{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {r.values.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => <td key={ci} className="p-2 border border-border font-mono whitespace-nowrap">{String(cell)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-muted mt-1">{r.values.length} hàng · {r.columns.length} cột</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="surface-card p-5 mt-6" style={{ borderLeft: "4px solid var(--warning)" }}>
        <h3 className="font-bold mb-1">Giới hạn trung thực</h3>
        <p className="text-sm text-muted">
          Môi trường PostgreSQL/MySQL tạm thời (ephemeral) <b>không khả dụng</b> trên gói Render Free — không có endpoint máy chủ cho SQL.
          Playground này chạy hoàn toàn bằng SQLite trong trình duyệt (WebAssembly). Dữ liệu chỉ tồn tại trong phiên; nút "Đặt lại môi trường" khôi phục CSDL mẫu.
          Nếu cần Postgres thật, hãy chạy API backend với DATABASE_URL thật.
        </p>
      </div>
    </div>
  );
}
