import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useApp } from "../store/AppContext";
import type { CommentDTO, ForumPostDTO } from "@hydyar/shared";
import MarkdownView from "../components/MarkdownView";
import CodeBlock from "../components/CodeBlock";

interface PostDetail extends ForumPostDTO {
  comments?: CommentDTO[];
}

export default function ForumPost() {
  const { id = "" } = useParams();
  const { user, toast } = useApp();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    api<PostDetail>(`/api/posts/${id}`)
      .then((p) => { setPost(p); setLiked(!!p.likedByMe); setLikeCount(p.likeCount); })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Không tải được bài viết"));
  };
  useEffect(load, [id]);

  const toggleLike = async () => {
    if (!user) { toast("Đăng nhập để thích", "info"); return; }
    try {
      await api(`/api/posts/${id}/like`, { method: "POST" });
      setLiked((v) => !v);
      setLikeCount((c) => c + (liked ? -1 : 1));
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Thất bại", "error");
    }
  };

  const submitComment = async (parentId?: string) => {
    if (!user) { toast("Đăng nhập để bình luận", "info"); return; }
    if (!commentText.trim()) return;
    setSubmitting(true);
    try {
      await api(`/api/posts/${id}/comments`, { method: "POST", body: { content: commentText, parentId } });
      setCommentText("");
      setReplyTo(null);
      load();
      toast("Đã gửi bình luận", "success");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Gửi thất bại", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const submitReport = async () => {
    if (!reportReason.trim()) { toast("Nêu lý do báo cáo", "info"); return; }
    try {
      await api(`/api/posts/${id}/report`, { method: "POST", body: { reason: reportReason } });
      toast("Đã gửi báo cáo cho quản trị viên", "success");
      setShowReport(false);
      setReportReason("");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Gửi thất bại", "error");
    }
  };

  const deletePost = async () => {
    if (!confirm("Xóa bài viết này?")) return;
    try {
      await api(`/api/posts/${id}`, { method: "DELETE" });
      toast("Đã xóa bài viết", "success");
      location.href = "/community/forum";
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Xóa thất bại", "error");
    }
  };

  if (error) return <div className="max-w-3xl mx-auto surface-card p-6" style={{ color: "var(--danger)" }}>{error}</div>;
  if (!post) return <div className="max-w-3xl mx-auto text-muted">Đang tải…</div>;

  return (
    <div className="max-w-3xl mx-auto">
      <Link to="/community/forum" className="text-sm text-accent-blue hover:underline">← Diễn đàn</Link>
      <div className="surface-card p-6 mt-3">
        <h1 className="text-2xl font-black mb-2">{post.title}</h1>
        <div className="flex items-center gap-3 text-xs text-muted mb-4 flex-wrap">
          <span>👤 {post.author.username}</span>
          <span>{new Date(post.createdAt).toLocaleString("vi-VN")}</span>
          {post.tags.map((t) => <span key={t} className="chip !text-[10px]">#{t}</span>)}
        </div>
        <MarkdownView content={post.content} />
        {post.codeSnippet && <div className="mt-4"><CodeBlock code={post.codeSnippet} language={post.language ?? "code"} /></div>}
        <div className="flex gap-2 mt-6 flex-wrap">
          <button className={`btn-ghost !py-2 text-sm ${liked ? "!text-[var(--danger)]" : ""}`} onClick={toggleLike}>♥ {likeCount}</button>
          <button className="btn-ghost !py-2 text-sm" onClick={() => setShowReport((v) => !v)}>⚑ Báo cáo</button>
          {user && (user.id === post.author.id || user.role === "ADMIN") && (
            <button className="btn-ghost !py-2 text-sm !text-[var(--danger)]" onClick={deletePost}>✕ Xóa bài</button>
          )}
        </div>
        {showReport && (
          <div className="mt-3 p-3 rounded-lg border border-border bg-surface-2">
            <textarea className="input-field min-h-[60px] text-sm" placeholder="Lý do báo cáo (bắt buộc)…" value={reportReason} onChange={(e) => setReportReason(e.target.value)} />
            <button className="btn-primary !py-1.5 text-xs mt-2" onClick={submitReport}>Gửi báo cáo</button>
          </div>
        )}
      </div>

      <h2 className="font-bold text-lg mt-6 mb-3">Bình luận ({post.comments?.length ?? 0})</h2>
      <div className="surface-card p-4 mb-4">
        {replyTo && <div className="text-xs text-muted mb-1">Đang trả lời bình luận · <button className="underline" onClick={() => setReplyTo(null)}>hủy</button></div>}
        <textarea className="input-field min-h-[70px] text-sm" placeholder={user ? "Viết bình luận…" : "Đăng nhập để bình luận"} value={commentText} onChange={(e) => setCommentText(e.target.value)} disabled={!user} />
        <button className="btn-primary !py-2 text-sm mt-2" onClick={() => submitComment(replyTo ?? undefined)} disabled={submitting || !user}>
          {submitting ? "Đang gửi…" : "Gửi bình luận"}
        </button>
      </div>

      <div className="space-y-3">
        {post.comments?.map((c) => (
          <CommentItem key={c.id} comment={c} depth={0} onReply={(id) => setReplyTo(id)} onSubmit={() => submitComment(replyTo ?? undefined)} replyTo={replyTo} setReplyTo={setReplyTo} canDelete={!!user && (user.id === c.author.id || user.role === "ADMIN")} postId={id} onDeleted={load} />
        ))}
        {(!post.comments || post.comments.length === 0) && <p className="text-sm text-muted">Chưa có bình luận.</p>}
      </div>
    </div>
  );
}

function CommentItem({ comment, depth, onReply, canDelete, postId, onDeleted }: {
  comment: CommentDTO; depth: number; onReply: (id: string) => void;
  onSubmit?: () => void; replyTo?: string | null; setReplyTo?: (id: string | null) => void;
  canDelete: boolean; postId: string; onDeleted: () => void;
}) {
  const { toast } = useApp();
  const del = async () => {
    if (!confirm("Xóa bình luận?")) return;
    try {
      await api(`/api/comments/${comment.id}`, { method: "DELETE" });
      toast("Đã xóa", "success");
      onDeleted();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Xóa thất bại", "error");
    }
  };
  return (
    <div className="surface-card p-4" style={{ marginLeft: depth * 20 }}>
      <div className="flex items-center gap-2 text-xs text-muted mb-1">
        <span className="font-semibold text-ink">{comment.author.username}</span>
        <span>{new Date(comment.createdAt).toLocaleString("vi-VN")}</span>
      </div>
      <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
      {comment.codeSnippet && <div className="mt-2"><CodeBlock code={comment.codeSnippet} compact /></div>}
      <div className="flex gap-3 mt-2 text-xs">
        <button className="text-accent-blue hover:underline" onClick={() => onReply(comment.id)}>Trả lời</button>
        {canDelete && <button className="text-[var(--danger)] hover:underline" onClick={del}>Xóa</button>}
      </div>
      {comment.replies?.map((r) => (
        <CommentItem key={r.id} comment={r} depth={depth + 1} onReply={onReply} canDelete={canDelete} postId={postId} onDeleted={onDeleted} />
      ))}
    </div>
  );
}
