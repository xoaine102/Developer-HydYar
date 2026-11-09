import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useApp } from "../store/AppContext";
import type { LearningDocFull, LearningDocMeta } from "@hydyar/shared";
import MarkdownView from "../components/MarkdownView";
import { addFavorite, recordProgress, isFavorited } from "./Profile";

interface TocItem {
  level: number;
  text: string;
  id: string;
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^\wà-ỹ\s-]/gi, "").trim().replace(/\s+/g, "-");
}

function extractToc(content: string): TocItem[] {
  const items: TocItem[] = [];
  const lines = content.split("\n");
  for (const line of lines) {
    const m = /^(#{1,3})\s+(.+)$/.exec(line);
    if (m) {
      const text = m[2].replace(/[*_`]/g, "").trim();
      items.push({ level: m[1].length, text, id: slugify(text) });
    }
  }
  return items;
}

// Inject ids into headings so TOC anchors work
function injectHeadingIds(content: string): string {
  return content
    .split("\n")
    .map((line) => {
      const m = /^(#{1,3})\s+(.+)$/.exec(line);
      if (!m) return line;
      const text = m[2].replace(/[*_`]/g, "").trim();
      return `${m[1]} <span id="${slugify(text)}"></span>${m[2]}`;
    })
    .join("\n");
}

export default function DocsLearn() {
  const { lang = "javascript", slug = "" } = useParams();
  const { user, openDocOverlay, toast } = useApp();
  const [doc, setDoc] = useState<LearningDocFull | null>(null);
  const [list, setList] = useState<LearningDocMeta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fav, setFav] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDoc(null);
    setError(null);
    api<LearningDocFull>(`/api/docs/${lang}/learning/${slug}`)
      .then((d) => {
        setDoc(d);
        setFav(user ? isFavorited(user.id, lang, slug) : false);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Không tải được bài học"));
    api<LearningDocMeta[]>(`/api/docs/${lang}/learning`).then(setList).catch(() => setList([]));
  }, [lang, slug, user]);

  const toc = useMemo(() => (doc ? extractToc(doc.content) : []), [doc]);
  const idx = list.findIndex((d) => d.slug === slug);
  const prev = idx > 0 ? list[idx - 1] : null;
  const next = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;

  const toggleFav = () => {
    if (!user || !doc) {
      toast("Đăng nhập để lưu yêu thích", "info");
      return;
    }
    if (fav) {
      toast("Bỏ yêu thích (quản lý tại Hồ sơ)", "info");
      setFav(false);
      return;
    }
    addFavorite(user.id, { lang, slug, title: doc.title, at: Date.now() });
    setFav(true);
    toast("Đã thêm vào yêu thích", "success");
  };

  const markDone = () => {
    if (!user || !doc) {
      toast("Đăng nhập để lưu tiến trình", "info");
      return;
    }
    recordProgress(user.id, { lang, slug, title: doc.title, percent: 100, at: Date.now() });
    setDone(true);
    toast("Đã đánh dấu hoàn thành", "success");
  };

  const openFloating = () => {
    if (!doc) return;
    openDocOverlay({ title: doc.title, lang, slug, kind: "learning" });
    toast("Đã mở cửa sổ nổi. Kéo đầu cửa sổ để di chuyển, ghim gần mép để thu nhỏ.", "success");
  };

  if (error) return <div className="max-w-3xl mx-auto surface-card p-6" style={{ color: "var(--danger)" }}>{error}</div>;
  if (!doc) return <div className="max-w-3xl mx-auto text-muted">Đang tải bài học…</div>;

  return (
    <div className="max-w-6xl mx-auto flex gap-6">
      {/* TOC */}
      <aside className="hidden lg:block w-56 shrink-0">
        <div className="sticky top-20 surface-card p-4 max-h-[70vh] overflow-y-auto">
          <div className="text-xs font-bold uppercase tracking-wider text-muted mb-2">Mục lục</div>
          {toc.length === 0 && <p className="text-xs text-muted">Bài này không có tiêu đề phụ.</p>}
          <ul className="space-y-1 text-sm">
            {toc.map((t, i) => (
              <li key={i} style={{ paddingLeft: (t.level - 1) * 12 }}>
                <a href={`#${t.id}`} className="text-muted hover:text-accent-purple line-clamp-2">{t.text}</a>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <article className="flex-1 min-w-0 surface-card p-5 sm:p-8">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Link to={`/docs/${lang}`} className="text-sm text-accent-blue hover:underline">← {lang}</Link>
          <span className="chip">{doc.level}</span>
        </div>
        <h1 className="text-3xl font-black mb-4">{doc.title}</h1>

        <div className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-border">
          <button className="btn-primary !py-2 text-sm" onClick={openFloating}>⧉ Mở nổi (overlay)</button>
          <button className={`btn-ghost !py-2 text-sm ${fav ? "!text-[var(--danger)]" : ""}`} onClick={toggleFav}>
            {fav ? "♥ Đã yêu thích" : "♡ Yêu thích"}
          </button>
          <button className={`btn-ghost !py-2 text-sm ${done ? "!text-[var(--success)]" : ""}`} onClick={markDone}>
            {done ? "✓ Đã hoàn thành" : "Đánh dấu hoàn thành"}
          </button>
          <Link to={`/ide?preset=khac&lang=${lang}`} className="btn-ghost !py-2 text-sm">Thực hành trong IDE →</Link>
        </div>

        <MarkdownView content={injectHeadingIds(doc.content)} />

        {doc.related && (
          <div className="mt-8 p-4 rounded-xl bg-surface-2">
            <div className="text-xs font-bold uppercase tracking-wider text-muted mb-2">Liên quan</div>
            <p className="text-sm">{doc.related}</p>
          </div>
        )}

        <div className="flex justify-between gap-3 mt-8 pt-4 border-t border-border">
          {prev ? (
            <Link to={`/docs/${lang}/learn/${prev.slug}`} className="btn-ghost text-sm flex-1 text-left">← {prev.title}</Link>
          ) : <span className="flex-1" />}
          {next ? (
            <Link to={`/docs/${lang}/learn/${next.slug}`} className="btn-primary text-sm flex-1 text-right">{next.title} →</Link>
          ) : <span className="flex-1" />}
        </div>
      </article>
    </div>
  );
}
