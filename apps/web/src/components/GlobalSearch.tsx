import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SearchResultItem } from "@hydyar/shared";
import { api } from "../lib/api";
import { useApp } from "../store/AppContext";

const TYPE_LABELS: Record<string, string> = {
  "learning-doc": "Bài học",
  "app-doc": "Tham khảo",
  project: "Dự án",
  post: "Bài viết",
  language: "Ngôn ngữ",
};

const TYPE_FILTERS = ["all", "learning-doc", "app-doc", "project", "post"] as const;

export default function GlobalSearch() {
  const [q, setQ] = useState("");
  const [type, setType] = useState<(typeof TYPE_FILTERS)[number]>("all");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { openDocOverlay, toast } = useApp();
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (!q.trim() || q.trim().length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: q.trim() });
        if (type !== "all") params.set("type", type);
        const data = await api<SearchResultItem[]>(`/api/search?${params.toString()}`);
        setResults(data ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Tìm kiếm thất bại");
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [q, type]);

  const go = (r: SearchResultItem) => {
    setOpen(false);
    setQ("");
    navigate(r.href);
  };

  const pinAsOverlay = (r: SearchResultItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (r.type === "learning-doc" && r.lang && r.slug) {
      openDocOverlay({ title: r.title, lang: r.lang, slug: r.slug, kind: "learning" });
      toast(`Đã ghim "${r.title}" dưới dạng cửa sổ nổi`, "success");
      setOpen(false);
    } else {
      toast("Chỉ bài học mới có thể ghim nổi", "info");
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-1 input-field !py-1.5">
        <span className="text-muted px-1">⌕</span>
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Tìm tài liệu, bài viết, dự án…"
          className="bg-transparent outline-none flex-1 text-sm min-w-0"
          aria-label="Tìm kiếm toàn cục"
        />
        {q && (
          <button className="text-muted hover:text-ink text-xs px-1" onClick={() => { setQ(""); setResults([]); }}>✕</button>
        )}
      </div>
      {open && q.trim().length >= 2 && (
        <div className="absolute top-full mt-2 left-0 right-0 surface-card shadow-overlay overflow-hidden z-50">
          <div className="flex gap-1 p-2 border-b border-border overflow-x-auto">
            {TYPE_FILTERS.map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`px-2.5 py-1 rounded-full text-xs whitespace-nowrap ${type === t ? "brand-gradient text-white font-semibold" : "bg-surface-2 text-muted"}`}
              >
                {t === "all" ? "Tất cả" : TYPE_LABELS[t] ?? t}
              </button>
            ))}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading && <div className="p-4 text-sm text-muted text-center">Đang tìm…</div>}
            {error && <div className="p-4 text-sm text-center" style={{ color: "var(--danger)" }}>{error}</div>}
            {!loading && !error && results.length === 0 && (
              <div className="p-4 text-sm text-muted text-center">Không tìm thấy kết quả. Thử từ khóa khác.</div>
            )}
            {results.map((r) => (
              <div
                key={`${r.type}-${r.id}`}
                onClick={() => go(r)}
                className="px-3 py-2 hover:bg-surface-2 cursor-pointer border-b border-border/50 last:border-0 group"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm truncate">{r.title}</span>
                  <span className="chip shrink-0">{TYPE_LABELS[r.type] ?? r.type}</span>
                </div>
                <div className="text-xs text-muted truncate mt-0.5">{r.snippet}</div>
                {r.type === "learning-doc" && (
                  <button
                    onClick={(e) => pinAsOverlay(r, e)}
                    className="mt-1 text-xs text-accent-purple hover:underline"
                  >
                    📌 Ghim cửa sổ nổi
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
