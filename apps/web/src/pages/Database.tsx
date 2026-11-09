import { Link } from "react-router-dom";

const TABLES = [
  { name: "User", desc: "Tài khoản người dùng (email, username, role ADMIN/USER, bio, avatar)." },
  { name: "Project + ProjectFile", desc: "Dự án code của người dùng, chứa nhiều file có đường dẫn và ngôn ngữ." },
  { name: "LearningDoc", desc: "Bài học theo ngôn ngữ (markdown), có thứ tự và cấp độ." },
  { name: "AppDocEntry", desc: "Bảng tham khảo ứng dụng (thành phần, quy tắc, giải thích, ví dụ)." },
  { name: "ForumPost + Comment", desc: "Bài viết diễn đàn với bình luận lồng nhau, lượt thích, báo cáo." },
  { name: "DocSuggestion", desc: "Đóng góp tài liệu từ cộng đồng, chờ quản trị duyệt." },
  { name: "PostReport", desc: "Báo cáo nội dung vi phạm, quản trị xử lý." },
  { name: "ChatRoom", desc: "Phòng chat thời gian thực (chung, javascript, python)." },
];

export default function Database() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-black mb-2">Cơ sở dữ liệu</h1>
      <p className="text-muted mb-6">
        HydYar sử dụng PostgreSQL làm CSDL chính. Trang này tổng quan thực thể. Bạn có thể thực hành SQL ngay trong trình duyệt tại SQL Playground (SQLite cục bộ).
      </p>

      <div className="surface-card p-4 mb-6 flex flex-wrap items-center gap-3">
        <span className="chip">PostgreSQL (chính)</span>
        <span className="chip">Prisma ORM</span>
        <span className="chip">tsvector tìm kiếm</span>
        <span className="chip">unaccent (không dấu)</span>
        <div className="flex-1" />
        <Link to="/sql" className="btn-primary !py-2 text-sm">Mở SQL Playground →</Link>
      </div>

      <h2 className="font-bold text-lg mb-3">Bảng / thực thể</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        {TABLES.map((t) => (
          <div key={t.name} className="surface-card p-4">
            <div className="font-mono font-bold text-accent-purple">{t.name}</div>
            <p className="text-sm text-muted mt-1">{t.desc}</p>
          </div>
        ))}
      </div>

      <div className="surface-card p-5 mt-6" style={{ borderLeft: "4px solid var(--warning)" }}>
        <h3 className="font-bold mb-1">Lưu ý trung thực</h3>
        <p className="text-sm text-muted">
          Môi trường PostgreSQL/MySQL tạm thời (ephemeral) <b>không khả dụng</b> trên gói Render Free. SQL Playground chạy hoàn toàn bằng SQLite (sql.js/WebAssembly)
          trong trình duyệt của bạn — dữ liệu chỉ tồn tại tại phiên làm việc và nút "Đặt lại môi trường" sẽ khôi phục CSDL mẫu.
        </p>
      </div>
    </div>
  );
}
