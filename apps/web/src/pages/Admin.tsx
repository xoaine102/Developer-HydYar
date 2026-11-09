import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { useApp } from "../store/AppContext";
import type { DocSuggestionDTO } from "@hydyar/shared";

interface Stats {
  users: number;
  projects: number;
  posts: number;
  pendingSuggestions: number;
  executionsToday: number;
}
interface Report {
  id: string;
  postId: string;
  reason: string;
  status: string;
  createdAt: string;
  post?: { title: string; author?: { username: string } };
}

export default function Admin() {
  const { toast } = useApp();
  const [stats, setStats] = useState<Stats | null>(null);
  const [suggestions, setSuggestions] = useState<DocSuggestionDTO[] | null>(null);
  const [reports, setReports] = useState<Report[] | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    api<Stats>("/api/admin/stats").then(setStats).catch((e) => setError(e instanceof ApiError ? e.message : "Không tải được thống kê"));
    api<DocSuggestionDTO[]>("/api/doc-suggestions").then(setSuggestions).catch(() => setSuggestions([]));
    api<Report[]>("/api/admin/reports").then(setReports).catch(() => setReports([]));
  };
  useEffect(load, []);

  const decideSuggestion = async (id: string, status: "APPROVED" | "REJECTED") => {
    try {
      await api(`/api/doc-suggestions/${id}`, { method: "PATCH", body: { status, feedback: feedback[id] ?? undefined } });
      toast(status === "APPROVED" ? "Đã duyệt đề xuất" : "Đã từ chối đề xuất", "success");
      load();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Thao tác thất bại", "error");
    }
  };

  const resolveReport = async (id: string) => {
    try {
      await api(`/api/admin/reports/${id}`, { method: "PATCH", body: { status: "RESOLVED" } });
      toast("Đã đánh dấu đã xử lý", "success");
      load();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Thất bại", "error");
    }
  };

  const statCards = stats ? [
    { label: "Người dùng", value: stats.users },
    { label: "Dự án", value: stats.projects },
    { label: "Bài viết", value: stats.posts },
    { label: "Đề xuất chờ duyệt", value: stats.pendingSuggestions },
    { label: "Lần chạy hôm nay", value: stats.executionsToday },
  ] : [];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-3xl font-black">Bảng điều khiển quản trị</h1>
      {error && <div className="surface-card p-4" style={{ color: "var(--danger)" }}>{error}</div>}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {statCards.map((s) => (
          <div key={s.label} className="surface-card p-4 text-center">
            <div className="text-3xl font-black brand-text">{s.value}</div>
            <div className="text-xs text-muted mt-1">{s.label}</div>
          </div>
        ))}
        {!stats && !error && <div className="text-muted text-sm">Đang tải thống kê…</div>}
      </div>

      <div className="surface-card p-5">
        <h2 className="font-bold text-lg mb-3">Đề xuất tài liệu ({suggestions?.length ?? 0})</h2>
        {suggestions === null && <p className="text-sm text-muted">Đang tải…</p>}
        {suggestions && suggestions.length === 0 && <p className="text-sm text-muted">Không có đề xuất nào.</p>}
        <div className="space-y-3">
          {suggestions?.map((s) => (
            <div key={s.id} className="p-3 rounded-lg border border-border bg-surface-2/40">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-semibold text-sm">{s.title}</span>
                <span className="chip !text-[10px]">{s.kind} · {s.lang} · {s.author.username}</span>
              </div>
              <p className="text-xs text-muted mt-1">Trạng thái: <b>{s.status}</b>{s.feedback ? ` · phản hồi: ${s.feedback}` : ""}</p>
              {s.status === "PENDING" && (
                <div className="flex gap-2 mt-2 flex-wrap items-center">
                  <input
                    className="input-field !py-1 text-xs max-w-xs flex-1"
                    placeholder="Phản hồi cho người đóng góp (tùy chọn)"
                    value={feedback[s.id] ?? ""}
                    onChange={(e) => setFeedback((f) => ({ ...f, [s.id]: e.target.value }))}
                  />
                  <button className="btn-primary !py-1 text-xs" onClick={() => decideSuggestion(s.id, "APPROVED")}>✓ Duyệt</button>
                  <button className="btn-ghost !py-1 text-xs !text-[var(--danger)]" onClick={() => decideSuggestion(s.id, "REJECTED")}>✕ Từ chối</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="surface-card p-5">
        <h2 className="font-bold text-lg mb-3">Báo cáo vi phạm ({reports?.length ?? 0})</h2>
        {reports === null && <p className="text-sm text-muted">Đang tải…</p>}
        {reports && reports.length === 0 && <p className="text-sm text-muted">Không có báo cáo mở.</p>}
        <div className="space-y-2">
          {reports?.map((r) => (
            <div key={r.id} className="p-3 rounded-lg border border-border flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{r.post?.title ?? `Bài viết ${r.postId}`}</div>
                <div className="text-xs text-muted">Lý do: {r.reason} · {new Date(r.createdAt).toLocaleString("vi-VN")} · {r.status}</div>
              </div>
              <button className="btn-ghost !py-1 text-xs" onClick={() => resolveReport(r.id)}>Đánh dấu đã xử lý</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
