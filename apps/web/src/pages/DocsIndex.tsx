import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import type { LearningDocMeta } from "@hydyar/shared";

const LANG_LABELS: Record<string, string> = {
  javascript: "JavaScript", python: "Python", lua: "Lua", c: "C", cpp: "C++",
  typescript: "TypeScript", php: "PHP", html: "HTML", css: "CSS", sql: "SQL", other: "Khác",
};

export default function DocsIndex() {
  const { lang = "javascript" } = useParams();
  const [docs, setDocs] = useState<LearningDocMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDocs(null);
    setError(null);
    api<LearningDocMeta[]>(`/api/docs/${lang}/learning`)
      .then(setDocs)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Không tải được danh sách bài học"));
  }, [lang]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <h1 className="text-3xl font-black">Tài liệu {LANG_LABELS[lang] ?? lang}</h1>
        <span className="chip">{lang}</span>
      </div>
      <div className="flex gap-2 mb-6">
        <Link to={`/docs/${lang}`} className="btn-primary !py-2 text-sm">Bài học</Link>
        <Link to={`/docs/${lang}/reference`} className="btn-ghost !py-2 text-sm">Bảng tham khảo</Link>
        <Link to={`/ide?preset=${lang === "html" || lang === "css" ? "web" : "khac"}&lang=${lang}`} className="btn-ghost !py-2 text-sm">Thực hành trong IDE →</Link>
      </div>

      {error && <div className="surface-card p-6" style={{ color: "var(--danger)" }}>{error}</div>}
      {docs === null && !error && <div className="text-muted">Đang tải…</div>}
      {docs && docs.length === 0 && (
        <div className="surface-card p-6 text-muted">
          Chưa có bài học cho ngôn ngữ này. Bạn có thể <Link to="/contribute" className="text-accent-blue underline">đóng góp bài học đầu tiên</Link>.
        </div>
      )}

      <div className="space-y-3">
        {docs?.map((d, i) => (
          <Link key={d.slug} to={`/docs/${lang}/learn/${d.slug}`} className="surface-card p-5 hover:shadow-soft transition flex items-start gap-4 block">
            <div className="brand-gradient text-white w-9 h-9 rounded-lg flex items-center justify-center font-bold shrink-0">{i + 1}</div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold">{d.title}</h3>
                <span className="chip !text-[10px]">{d.level}</span>
              </div>
              {d.summary && <p className="text-sm text-muted mt-1 line-clamp-2">{d.summary}</p>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
