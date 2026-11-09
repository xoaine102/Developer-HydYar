import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../store/AppContext";
import GlobalSearch from "./GlobalSearch";
import { useEffect, useState } from "react";

const DOC_LANGS: { code: string; label: string }[] = [
  { code: "javascript", label: "JavaScript" },
  { code: "python", label: "Python" },
  { code: "lua", label: "Lua" },
  { code: "c", label: "C" },
  { code: "cpp", label: "C++" },
  { code: "typescript", label: "TypeScript" },
  { code: "php", label: "PHP" },
  { code: "html", label: "HTML" },
  { code: "css", label: "CSS" },
  { code: "sql", label: "SQL" },
  { code: "other", label: "Khác" },
];

const CODE_PRESETS: { key: string; label: string; to: string; desc: string }[] = [
  { key: "server", label: "Server", to: "/ide?preset=server", desc: "Môi trường Node.js backend" },
  { key: "termux", label: "Termux", to: "/ide?preset=termux", desc: "Hướng dẫn code trên Android Termux" },
  { key: "web", label: "Web", to: "/ide?preset=web", desc: "HTML/CSS/JS có preview trực tiếp" },
  { key: "app", label: "App", to: "/ide?preset=app", desc: "Khởi đầu ứng dụng di động" },
  { key: "khac", label: "Khác", to: "/ide", desc: "IDE trống, tự chọn ngôn ngữ" },
];

interface NavGroup {
  title: string;
  items: { label: string; to: string; end?: boolean; icon: string }[];
}

function useNavGroups(): NavGroup[] {
  const { user } = useApp();
  return [
    {
      title: "Tổng quan",
      items: [
        { label: "Trang chủ", to: "/", end: true, icon: "⌂" },
        { label: "Database", to: "/database", icon: "▤" },
      ],
    },
    {
      title: "Công cụ",
      items: [
        { label: "IDE trực tuyến", to: "/ide", icon: "‹/›" },
        { label: "SQL Playground", to: "/sql", icon: "◫" },
        { label: "Lua Graphics Studio", to: "/lua-studio", icon: "◉" },
      ],
    },
    {
      title: "Cộng đồng",
      items: [
        { label: "Diễn đàn", to: "/community/forum", icon: "✎" },
        { label: "Trò chuyện", to: "/community/chat", icon: "◉" },
      ],
    },
    {
      title: "Tài khoản",
      items: user
        ? [
            { label: "Hồ sơ", to: "/account/profile", icon: "☺" },
            { label: "Hỗ trợ", to: "/account/support", icon: "?" },
            ...(user.role === "ADMIN" ? [{ label: "Quản trị", to: "/admin", icon: "⚙" }] : []),
          ]
        : [
            { label: "Đăng nhập", to: "/login", icon: "→" },
            { label: "Đăng ký", to: "/register", icon: "+" },
            { label: "Hỗ trợ", to: "/account/support", icon: "?" },
          ],
    },
  ];
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const groups = useNavGroups();
  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 gap-4">
      <div className="px-2 pt-1">
        <Link to="/" onClick={onNavigate} className="flex items-center gap-2">
          <span className="brand-gradient text-white font-black text-lg w-9 h-9 rounded-xl flex items-center justify-center shadow-soft">H</span>
          <div>
            <div className="font-extrabold text-lg leading-tight brand-text">HydYar</div>
            <div className="text-[10px] text-muted uppercase tracking-widest">Developer</div>
          </div>
        </Link>
      </div>

      <div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted px-2 mb-1">Tổng quan</div>
        {groups[0].items.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end} onClick={onNavigate} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <span className="w-5 text-center">{it.icon}</span>
            <span>{it.label}</span>
          </NavLink>
        ))}
      </div>

      <div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted px-2 mb-1">Tài liệu</div>
        <div className="grid grid-cols-2 gap-x-1">
          {DOC_LANGS.map((l) => (
            <NavLink
              key={l.code}
              to={`/docs/${l.code}`}
              onClick={onNavigate}
              className={({ isActive }) => `nav-item !py-1.5 !px-2 text-xs ${isActive ? "active" : ""}`}
            >
              {l.label}
            </NavLink>
          ))}
        </div>
        <Link to="/contribute" onClick={onNavigate} className="nav-item !text-xs mt-1 text-muted">
          <span className="w-5 text-center">+</span> Đóng góp tài liệu
        </Link>
      </div>

      <div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted px-2 mb-1">Lập trình</div>
        {CODE_PRESETS.map((p) => (
          <NavLink key={p.key} to={p.to} onClick={onNavigate} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <span className="w-5 text-center">›</span>
            <span className="flex-1">{p.label}</span>
          </NavLink>
        ))}
      </div>

      {groups.slice(1).map((g) => (
        <div key={g.title}>
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted px-2 mb-1">{g.title}</div>
          {g.items.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.end} onClick={onNavigate} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              <span className="w-5 text-center">{it.icon}</span>
              <span>{it.label}</span>
            </NavLink>
          ))}
        </div>
      ))}
    </div>
  );
}

const MOBILE_BOTTOM = [
  { label: "Trang chủ", to: "/", icon: "⌂", end: true },
  { label: "Tài liệu", to: "/docs/javascript", icon: "▤" },
  { label: "IDE", to: "/ide", icon: "‹/›" },
  { label: "Cộng đồng", to: "/community/forum", icon: "✎" },
  { label: "Tôi", to: "/account/profile", icon: "☺" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme, user, logout, drawerOpen, setDrawer } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    setDrawer(false);
    setMenuOpen(false);
  }, [location.pathname, setDrawer]);

  const isIDE = location.pathname.startsWith("/ide");

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 fixed inset-y-0 left-0 z-30" style={{ background: "var(--surface)", backdropFilter: "blur(14px)", borderRight: "1px solid var(--border)" }}>
        <SidebarContent />
      </aside>

      {/* Tablet/mobile drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] surface-card rounded-none border-r shadow-overlay" style={{ background: "var(--surface-2)" }}>
            <SidebarContent onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className={`flex-1 flex flex-col min-w-0 ${isIDE ? "" : "lg:ml-64"}`}>
        {/* Header */}
        <header
          className="sticky top-0 z-40 flex items-center gap-2 px-3 sm:px-4 py-2.5"
          style={{ background: "var(--surface)", backdropFilter: "blur(14px)", borderBottom: "1px solid var(--border)" }}
        >
          <button className="lg:hidden btn-ghost !p-2" onClick={() => setDrawer(!drawerOpen)} aria-label="Mở menu">
            ☰
          </button>
          <Link to="/" className="lg:hidden flex items-center gap-2">
            <span className="brand-gradient text-white font-black w-8 h-8 rounded-lg flex items-center justify-center">H</span>
            <span className="font-extrabold brand-text">HydYar</span>
          </Link>
          <div className="flex-1 min-w-0 max-w-xl mx-auto">
            <GlobalSearch />
          </div>
          <button className="btn-ghost !p-2" onClick={toggleTheme} aria-label="Đổi giao diện" title={theme === "light" ? "Chuyển Dark" : "Chuyển Light"}>
            {theme === "light" ? "☾" : "☀"}
          </button>
          {user ? (
            <div className="relative">
              <button className="btn-ghost !py-1.5 !px-2 flex items-center gap-2" onClick={() => setMenuOpen((v) => !v)}>
                <span className="brand-gradient text-white w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold">
                  {user.username.slice(0, 2).toUpperCase()}
                </span>
                <span className="hidden sm:inline text-sm max-w-[100px] truncate">{user.username}</span>
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-48 surface-card p-2 shadow-overlay z-50">
                    <div className="px-2 py-1 text-xs text-muted border-b border-border mb-1">
                      {user.username} · {user.role === "ADMIN" ? "Quản trị" : "Thành viên"}
                    </div>
                    <button className="nav-item" onClick={() => { setMenuOpen(false); navigate("/account/profile"); }}>Hồ sơ</button>
                    <button className="nav-item" onClick={() => { setMenuOpen(false); navigate("/account/support"); }}>Hỗ trợ</button>
                    {user.role === "ADMIN" && (
                      <button className="nav-item" onClick={() => { setMenuOpen(false); navigate("/admin"); }}>Quản trị</button>
                    )}
                    <button
                      className="nav-item !text-[var(--danger)]"
                      onClick={async () => { setMenuOpen(false); await logout(); navigate("/"); }}
                    >
                      Đăng xuất
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="btn-ghost !py-1.5 !px-3 text-sm hidden sm:block">Đăng nhập</Link>
              <Link to="/register" className="btn-primary !py-1.5 !px-3 text-sm">Đăng ký</Link>
            </div>
          )}
        </header>

        {/* Content */}
        <main className={`flex-1 min-w-0 ${isIDE ? "" : "p-3 sm:p-5 lg:p-8"} pb-20 lg:pb-8`}>{children}</main>

        {/* Mobile bottom nav */}
        <nav
          className="lg:hidden fixed bottom-0 inset-x-0 z-40 flex items-stretch justify-around px-1 py-1.5"
          style={{ background: "var(--surface)", backdropFilter: "blur(14px)", borderTop: "1px solid var(--border)" }}
        >
          {MOBILE_BOTTOM.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] flex-1 ${isActive ? "text-white brand-gradient font-semibold" : "text-muted"}`
              }
            >
              <span className="text-base leading-none">{it.icon}</span>
              <span>{it.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
