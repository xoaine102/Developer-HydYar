import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { useApp } from "../store/AppContext";
import type { DocSuggestionDTO } from "@hydyar/shared";

const LANGS = ["javascript", "python", "lua", "c", "cpp", "typescript", "php", "html", "css", "sql", "other"];

export default function Contribute() {
  const { user, toast } = useApp();
  const [kind, setKind] = useState<"LEARNING" | "APPLICATION">("LEARNING");
  const [lang, setLang] = useState("javascript");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mine, setMine] = useState<DocSuggestionDTO[] | null>(null);

  const loadMine = () => {
    if (!user) return;
    api<DocSuggestionDTO[]>("/api/doc-suggestions/mine").then(setMine).catch(() => setMine([]));
  };
  useEffect(loadMine, [user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast("Vui lòng đăng nhập để đóng góp", "error");
      return;
    }
    setSubmitting(true);
    try {
      await api("/api/doc-suggestions", { method: "POST", body: { kind, lang, title, content } });
      toast("Đã gửi đề xuất. Quản trị viên sẽ xem xét.", "success");
      setTitle("");
      setContent("");
      loadMine();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Gửi thất bại", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const statusColor = (s: string) =>
    s === "APPROVED" ? "var(--success)" : s === "REJECTED" ? "var(--danger)" : "var(--warning)";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-black mb-2">Đóng góp tài liệu</h1>
        <p className="text-muted">Gửi đề xuất bài học hoặc mục tham khảo. Quản trị viên duyệt và có thể chỉnh sửa trước khi xuất bản.</p>
      </div>

      <form onSubmit={submit} className="surface-card p-6 space-y-4">
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="text-sm font-medium block mb-1">Loại</label>
            <select className="input-field" value={kind} onChange={(e) => setKind(e.target.value as any)}>
              <option value="LEARNING">Bài học (learning)</option>
              <option value="APPLICATION">Bảng tham khảo (application)</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Ngôn ngữ</label>
            <select className="input-field" value={lang} onChange={(e) => setLang(e.target.value)}>
              {LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Tiêu đề</label>
            <input className="input-field" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ví dụ: Vòng lặp for" />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Nội dung (hỗ trợ Markdown)</label>
          <textarea className="input-field min-h-[180px] font-mono text-sm" required value={content} onChange={(e) => setContent(e.target.value)} placeholder="# Tiêu đề\n\nNội dung bài học…" />
        </div>
        <button type="submit" className="btn-primary" disabled={submitting || !user}>
          {!user ? "Đăng nhập để gửi" : submitting ? "Đang gửi…" : "Gửi đề xuất"}
        </button>
      </form>

      <div className="surface-card p-6">
        <h2 className="font-bold text-lg mb-3">Đề xuất của tôi</h2>
        {mine === null && <p className="text-sm text-muted">Đang tải…</p>}
        {mine && mine.length === 0 && <p className="text-sm text-muted">Chưa có đề xuất nào.</p>}
        <ul className="space-y-2">
          {mine?.map((s) => (
            <li key={s.id} className="p-3 rounded-lg border border-border bg-surface-2/50">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-sm truncate">{s.title}</span>
                <span className="chip !text-xs" style={{ color: statusColor(s.status), borderColor: statusColor(s.status) }}>
                  {s.status === "PENDING" ? "Chờ duyệt" : s.status === "APPROVED" ? "Đã duyệt" : "Từ chối"}
                </span>
              </div>
              <div className="text-xs text-muted mt-1">
                {s.kind} · {s.lang} · {new Date(s.createdAt).toLocaleDateString("vi-VN")}
              </div>
              {s.feedback && <div className="text-xs mt-1.5 p-2 rounded bg-surface">Phản hồi quản trị: {s.feedback}</div>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
