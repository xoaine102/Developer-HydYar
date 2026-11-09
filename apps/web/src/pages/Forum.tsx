import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useApp } from "../store/AppContext";
import type { ForumPostDTO } from "@hydyar/shared";
import CodeBlock from "../components/CodeBlock";

export default function Forum() {
  const { user, toast } = useApp();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const tag = params.get("tag") ?? "";
  const [posts, setPosts] = useState<ForumPostDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [codeSnippet, setCodeSnippet] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [tags, setTags] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setPosts(null);
    setError(null);
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (tag) p.set("tag", tag);
    api<ForumPostDTO[]>(`/api/posts?${p.toString()}`)
      .then(setPosts)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Không tải được bài viết"));
  }, [q, tag]);

  const allTags = Array.from(new Set((posts ?? []).flatMap((p) => p.tags))).slice(0, 12);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { toast("Đăng nhập để đăng bài", "error"); return; }
    setSubmitting(true);
    try {
      const body: any = { title, content, tags: tags.split(",").map((t) => t.trim()).filter(Boolean) };
      if (codeSnippet.trim()) { body.codeSnippet = codeSnippet; body.language = language; }
      await api("/api/posts", { method: "POST", body });
      toast("Đã đăng bài", "success");
      setShowCreate(false);
      setTitle(""); setContent(""); setCodeSnippet(""); setTags("");
      const p = new URLSearchParams(); if (q) p.set("q", q); if (tag) p.set("tag", tag);
      api<ForumPostDTO[]>(`/api/posts?${p.toString()}`).then(setPosts).catch(() => {});
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Đăng thất bại", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <h1 className="text-3xl font-black">Diễn đàn</h1>
        <div className="flex-1" />
        <button className="btn-primary !py-2 text-sm" onClick={() => (user ? setShowCreate(true) : toast("Đăng nhập để đăng bài", "info"))}>+ Đăng bài</button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <input
          className="input-field max-w-xs"
          placeholder="Tìm bài viết…"
          value={q}
          onChange={(e) => { const p = new URLSearchParams(params); if (e.target.value) p.set("q", e.target.value); else p.delete("q"); setParams(p); }}
        />
        <button className="btn-ghost !py-2 text-sm" onClick={() => setParams(new URLSearchParams())}>Xóa lọc</button>
      </div>
      {allTags.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-4">
          {allTags.map((t) => (
            <button key={t} className={`chip ${tag === t ? "!bg-[var(--accent-purple)] !text-white !border-transparent" : ""}`} onClick={() => { const p = new URLSearchParams(params); if (tag === t) p.delete("tag"); else p.set("tag", t); setParams(p); }}>
              #{t}
            </button>
          ))}
        </div>
      )}

      {error && <div className="surface-card p-6" style={{ color: "var(--danger)" }}>{error}</div>}
      {posts === null && !error && <div className="text-muted">Đang tải…</div>}
      {posts && posts.length === 0 && <div className="surface-card p-6 text-muted">Chưa có bài viết nào. Hãy đăng bài đầu tiên!</div>}

      <div className="space-y-3">
        {posts?.map((p) => (
          <Link key={p.id} to={`/community/forum/${p.id}`} className="surface-card p-5 hover:shadow-soft transition block">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-lg">{p.title}</h3>
              {p.tags.map((t) => <span key={t} className="chip !text-[10px]">#{t}</span>)}
            </div>
            <p className="text-sm text-muted mt-1 line-clamp-2">{p.content}</p>
            <div className="flex items-center gap-4 mt-3 text-xs text-muted">
              <span>👤 {p.author.username}</span>
              <span>♥ {p.likeCount}</span>
              <span>💬 {p.commentCount}</span>
              <span>{new Date(p.createdAt).toLocaleString("vi-VN")}</span>
            </div>
          </Link>
        ))}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCreate(false)} />
          <div className="relative surface-card p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Đăng bài mới</h2>
            <form onSubmit={submit} className="space-y-3">
              <input className="input-field" placeholder="Tiêu đề" required value={title} onChange={(e) => setTitle(e.target.value)} />
              <textarea className="input-field min-h-[100px]" placeholder="Nội dung (hỗ trợ Markdown)" required value={content} onChange={(e) => setContent(e.target.value)} />
              <div>
                <label className="text-xs text-muted block mb-1">Đoạn code đính kèm (tùy chọn)</label>
                <select className="input-field mb-1 max-w-[180px]" value={language} onChange={(e) => setLanguage(e.target.value)}>
                  {["javascript", "typescript", "python", "lua", "c", "cpp", "php", "html", "css", "sql"].map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
                <textarea className="input-field min-h-[100px] font-mono text-xs" placeholder="console.log('xin chào');" value={codeSnippet} onChange={(e) => setCodeSnippet(e.target.value)} />
              </div>
              <input className="input-field" placeholder="Thẻ (cách nhau bởi dấu phẩy), ví dụ: javascript, beginner" value={tags} onChange={(e) => setTags(e.target.value)} />
              <div className="flex gap-2 justify-end">
                <button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>Hủy</button>
                <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? "Đang đăng…" : "Đăng bài"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Re-export for detail page usage
export { CodeBlock };
