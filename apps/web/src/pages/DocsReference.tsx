import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import type { AppDocEntryDTO } from "@hydyar/shared";
import ScrollLockTable from "../components/ScrollLockTable";
import CodeBlock from "../components/CodeBlock";

const LANG_LABELS: Record<string, string> = {
  javascript: "JavaScript", python: "Python", lua: "Lua", c: "C", cpp: "C++",
  typescript: "TypeScript", php: "PHP", html: "HTML", css: "CSS", sql: "SQL", other: "Khác",
};

export default function DocsReference() {
  const { lang = "javascript" } = useParams();
  const [entries, setEntries] = useState<AppDocEntryDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>("all");

  useEffect(() => {
    setEntries(null);
    setError(null);
    const params = category === "all" ? "" : `?category=${encodeURIComponent(category)}`;
    api<AppDocEntryDTO[]>(`/api/docs/${lang}/application${params}`)
      .then(setEntries)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Không tải được bảng tham khảo"));
  }, [lang, category]);

  const categories = useMemo(() => {
    if (!entries) return [] as string[];
    return Array.from(new Set(entries.map((e) => e.category)));
  }, [entries]);

  const shown = category === "all" ? entries : entries?.filter((e) => e.category === category);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <h1 className="text-3xl font-black">Tham khảo {LANG_LABELS[lang] ?? lang}</h1>
      </div>
      <p className="text-muted text-sm mb-4">Bảng 4 cột: Thành phần (sao chép được), Quy tắc, Giải thích, Ví dụ. Cuộn ngang/dọc được khóa hướng theo cử chỉ.</p>
      <div className="flex gap-2 mb-4 flex-wrap">
        <Link to={`/docs/${lang}`} className="btn-ghost !py-2 text-sm">← Bài học</Link>
        <button className={`!py-2 text-sm px-3 rounded-lg ${category === "all" ? "brand-gradient text-white font-semibold" : "btn-ghost"}`} onClick={() => setCategory("all")}>Tất cả</button>
        {categories.map((c) => (
          <button key={c} className={`!py-2 text-sm px-3 rounded-lg ${category === c ? "brand-gradient text-white font-semibold" : "btn-ghost"}`} onClick={() => setCategory(c)}>{c}</button>
        ))}
      </div>

      {error && <div className="surface-card p-6" style={{ color: "var(--danger)" }}>{error}</div>}
      {entries === null && !error && <div className="text-muted">Đang tải…</div>}
      {entries && entries.length === 0 && (
        <div className="surface-card p-6 text-muted">Chưa có mục tham khảo. <Link to="/contribute" className="text-accent-blue underline">Đóng góp?</Link></div>
      )}

      {shown && shown.length > 0 && (
        <div className="surface-card overflow-hidden">
          <ScrollLockTable className="max-h-[70vh]">
            <table className="w-full text-sm border-collapse" style={{ minWidth: 900 }}>
              <thead className="sticky top-0 z-10" style={{ background: "var(--surface-2)" }}>
                <tr>
                  <th className="text-left p-3 border-b border-border font-bold w-[18%]">Thành phần</th>
                  <th className="text-left p-3 border-b border-border font-bold w-[24%]">Quy tắc</th>
                  <th className="text-left p-3 border-b border-border font-bold w-[28%]">Giải thích</th>
                  <th className="text-left p-3 border-b border-border font-bold w-[30%]">Ví dụ code</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((e, i) => (
                  <tr key={e.id ?? i} className="align-top border-b border-border/60 last:border-0 hover:bg-surface-2/40">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-xs bg-surface-2 px-2 py-1 rounded border border-border break-all">{e.component}</code>
                        <CopyText text={e.component} />
                      </div>
                      {e.category && <div className="chip !text-[10px] mt-2">{e.category}</div>}
                    </td>
                    <td className="p-3 text-muted whitespace-pre-wrap">{e.rule}</td>
                    <td className="p-3 whitespace-pre-wrap">{e.explanation}</td>
                    <td className="p-3">
                      <CodeBlock code={e.example} language={lang} compact />
                      {e.exampleNote && (
                        <p className="text-xs mt-2 italic" style={{ color: "var(--warning)" }}>
                          Lưu ý: {e.exampleNote} (chữ in nghiêng / placeholder cần thay thế bằng giá trị thật).
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollLockTable>
        </div>
      )}
    </div>
  );
}

function CopyText({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="text-xs px-2 py-1 rounded border border-border hover:bg-surface-2 shrink-0"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          /* ignore */
        }
      }}
      title="Sao chép chính xác văn bản"
    >
      {copied ? "✓" : "Copy"}
    </button>
  );
}
