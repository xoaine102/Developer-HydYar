import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useApp } from "../store/AppContext";
import type { ProjectDTO, LearningDocMeta } from "@hydyar/shared";

function favKey(userId: string) {
  return `hydyar-favs-${userId}`;
}
function progressKey(userId: string) {
  return `hydyar-progress-${userId}`;
}

interface FavEntry {
  lang: string;
  slug: string;
  title: string;
  at: number;
}
interface ProgressEntry {
  lang: string;
  slug: string;
  title: string;
  percent: number;
  at: number;
}

export default function Profile() {
  const { user, refreshMe, toast } = useApp();
  const [bio, setBio] = useState(user?.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [projects, setProjects] = useState<ProjectDTO[] | null>(null);
  const [projError, setProjError] = useState<string | null>(null);
  const [favs, setFavs] = useState<FavEntry[]>([]);
  const [progress, setProgress] = useState<ProgressEntry[]>([]);

  useEffect(() => {
    if (!user) return;
    setBio(user.bio ?? "");
    api<ProjectDTO[]>("/api/projects")
      .then(setProjects)
      .catch((e) => setProjError(e instanceof ApiError ? e.message : "Không tải được dự án"));
    try {
      setFavs(JSON.parse(localStorage.getItem(favKey(user.id)) ?? "[]"));
      setProgress(JSON.parse(localStorage.getItem(progressKey(user.id)) ?? "[]"));
    } catch {
      /* ignore */
    }
  }, [user]);

  const saveBio = async () => {
    setSaving(true);
    try {
      await api("/api/me", { method: "PATCH", body: { bio } });
      await refreshMe();
      toast("Đã lưu hồ sơ", "success");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Lưu thất bại", "error");
    } finally {
      setSaving(false);
    }
  };

  const removeFav = (idx: number) => {
    if (!user) return;
    const next = favs.filter((_, i) => i !== idx);
    setFavs(next);
    localStorage.setItem(favKey(user.id), JSON.stringify(next));
    toast("Đã bỏ yêu thích", "info");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="surface-card p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="brand-gradient text-white w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black">
            {user?.username.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-black">{user?.username}</h1>
            <p className="text-muted text-sm">{user?.email} · {user?.role === "ADMIN" ? "Quản trị viên" : "Thành viên"}</p>
          </div>
        </div>
        <label className="text-sm font-medium block mb-1">Tiểu sử (bio)</label>
        <textarea className="input-field min-h-[80px]" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Kể vài dòng về bạn…" />
        <div className="mt-3 flex gap-2">
          <button className="btn-primary !py-2 text-sm" onClick={saveBio} disabled={saving}>
            {saving ? "Đang lưu…" : "Lưu hồ sơ"}
          </button>
        </div>
      </div>

      <div className="surface-card p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-lg">Dự án của tôi</h2>
          <Link to="/ide" className="btn-ghost !py-1.5 text-sm">+ Tạo dự án mới</Link>
        </div>
        {projError && <p className="text-sm" style={{ color: "var(--danger)" }}>{projError}</p>}
        {projects === null && !projError && <p className="text-sm text-muted">Đang tải…</p>}
        {projects && projects.length === 0 && <p className="text-sm text-muted">Chưa có dự án. Hãy tạo dự án đầu tiên trong IDE.</p>}
        <div className="grid sm:grid-cols-2 gap-3">
          {projects?.map((p) => (
            <Link key={p.id} to={`/ide/${p.id}`} className="surface-card p-4 hover:shadow-soft transition block">
              <div className="font-semibold truncate">{p.name}</div>
              <div className="text-xs text-muted mt-1">
                {p.language} · {p.fileCount ?? 0} file · cập nhật {new Date(p.updatedAt).toLocaleDateString("vi-VN")}
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        <div className="surface-card p-6">
          <h2 className="font-bold text-lg mb-3">Bài đã yêu thích</h2>
          {favs.length === 0 && <p className="text-sm text-muted">Chưa có. Nhấn ♥ trên trang bài học để lưu.</p>}
          <ul className="space-y-2">
            {favs.map((f, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <Link to={`/docs/${f.lang}/learn/${f.slug}`} className="text-accent-blue hover:underline flex-1 truncate">{f.title}</Link>
                <button className="text-xs text-muted hover:text-[var(--danger)]" onClick={() => removeFav(i)}>Bỏ</button>
              </li>
            ))}
          </ul>
        </div>
        <div className="surface-card p-6">
          <h2 className="font-bold text-lg mb-3">Tiến trình học</h2>
          {progress.length === 0 && <p className="text-sm text-muted">Đọc bài học và đánh dấu hoàn thành để theo dõi tại đây.</p>}
          <ul className="space-y-2">
            {progress.map((p, i) => (
              <li key={i} className="text-sm">
                <Link to={`/docs/${p.lang}/learn/${p.slug}`} className="text-accent-blue hover:underline">{p.title}</Link>
                <div className="h-1.5 rounded-full bg-surface-2 mt-1 overflow-hidden">
                  <div className="h-full brand-gradient" style={{ width: `${p.percent}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="text-xs text-muted text-center">Yêu thích & tiến trình được lưu cục bộ trên trình duyệt (chưa đồng bộ máy chủ).</p>
    </div>
  );
}

// Helper exported for doc pages to record favorites/progress
export function addFavorite(userId: string, entry: FavEntry) {
  const key = favKey(userId);
  const list: FavEntry[] = JSON.parse(localStorage.getItem(key) ?? "[]");
  if (!list.some((f) => f.lang === entry.lang && f.slug === entry.slug)) {
    list.unshift(entry);
    localStorage.setItem(key, JSON.stringify(list.slice(0, 100)));
  }
}
export function recordProgress(userId: string, entry: ProgressEntry) {
  const key = progressKey(userId);
  const list: ProgressEntry[] = JSON.parse(localStorage.getItem(key) ?? "[]");
  const idx = list.findIndex((p) => p.lang === entry.lang && p.slug === entry.slug);
  if (idx >= 0) list[idx] = entry;
  else list.unshift(entry);
  localStorage.setItem(key, JSON.stringify(list.slice(0, 200)));
}
export function isFavorited(userId: string, lang: string, slug: string): boolean {
  try {
    const list: FavEntry[] = JSON.parse(localStorage.getItem(favKey(userId)) ?? "[]");
    return list.some((f) => f.lang === lang && f.slug === slug);
  } catch {
    return false;
  }
}
export type { FavEntry, ProgressEntry };
export type { LearningDocMeta };
