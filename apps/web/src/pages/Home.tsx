import { Link } from "react-router-dom";
import { useApp } from "../store/AppContext";

const FEATURES = [
  { to: "/ide", icon: "‹/›", title: "IDE trực tuyến", desc: "Chạy JavaScript/TypeScript/Python/Lua/SQL ngay trong trình duyệt, không cần cài đặt." },
  { to: "/docs/javascript", icon: "▤", title: "Tài liệu học lập trình", desc: "Học 10+ ngôn ngữ từ cơ bản đến nâng cao, mở nổi để đọc trong khi code." },
  { to: "/sql", icon: "◫", title: "SQL Playground", desc: "Thực hành SQLite với cơ sở dữ liệu mẫu, chạy truy vấn tức thì." },
  { to: "/lua-studio", icon: "◉", title: "Lua Graphics Studio", title2: "", desc: "Vẽ đồ họa 2D bằng Lua, đồng bộ hai chiều giữa code và trình chỉnh sửa trực quan." },
  { to: "/community/forum", icon: "✎", title: "Diễn đàn cộng đồng", desc: "Đặt câu hỏi, chia sẻ code, thảo luận cùng người học khác." },
  { to: "/community/chat", icon: "◉", title: "Chat thời gian thực", desc: "Các phòng chat theo ngôn ngữ, kết nối Socket.IO." },
];

const LANGS = [
  { code: "javascript", label: "JavaScript" },
  { code: "python", label: "Python" },
  { code: "lua", label: "Lua" },
  { code: "typescript", label: "TypeScript" },
  { code: "cpp", label: "C++" },
  { code: "sql", label: "SQL" },
];

export default function Home() {
  const { user } = useApp();
  return (
    <div className="max-w-6xl mx-auto">
      <section className="text-center py-10 sm:py-16">
        <div className="chip mx-auto mb-4">Học · Code · Chạy · Chia sẻ — tất cả trong một</div>
        <h1 className="text-3xl sm:text-5xl font-black leading-tight">
          Học lập trình cùng <span className="brand-text">Developer HydYar</span>
        </h1>
        <p className="text-muted mt-4 max-w-2xl mx-auto text-base sm:text-lg">
          Nền tảng tiếng Việt với IDE trực tuyến, tài liệu mở nổi, SQL playground, Lua Graphics Studio và cộng đồng đồng hành.
        </p>
        <div className="flex flex-wrap justify-center gap-3 mt-8">
          <Link to="/ide" className="btn-primary">Bắt đầu code ngay</Link>
          <Link to="/docs/javascript" className="btn-ghost">Xem tài liệu</Link>
          {!user && <Link to="/register" className="btn-ghost">Tạo tài khoản miễn phí</Link>}
        </div>
      </section>

      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {FEATURES.map((f) => (
          <Link key={f.to} to={f.to} className="surface-card p-5 hover:shadow-soft transition group">
            <div className="w-11 h-11 rounded-xl brand-gradient text-white flex items-center justify-center text-xl font-bold mb-3 group-hover:scale-110 transition">
              {f.icon}
            </div>
            <h3 className="font-bold text-lg">{f.title}</h3>
            <p className="text-muted text-sm mt-1.5 leading-relaxed">{f.desc}</p>
          </Link>
        ))}
      </section>

      <section className="mt-10 surface-card p-6">
        <h2 className="font-bold text-xl mb-4">Bắt đầu theo ngôn ngữ</h2>
        <div className="flex flex-wrap gap-2">
          {LANGS.map((l) => (
            <Link key={l.code} to={`/docs/${l.code}`} className="chip hover:!border-accent-purple hover:text-ink transition">
              {l.label} →
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
