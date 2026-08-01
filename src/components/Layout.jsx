import {
  BookOpen,
  ChevronLeft,
  Headphones,
  Home,
  Library,
  Menu,
  Moon,
  Plus,
  Settings,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { id: "dashboard", label: "Tổng quan", icon: Home },
  { id: "library", label: "Bộ từ của tôi", icon: Library },
  { id: "listening", label: "Luyện nghe", icon: Headphones },
  { id: "import", label: "Tạo bộ từ", icon: Plus, accent: true },
  { id: "settings", label: "Cài đặt", icon: Settings },
];

const mobileNavItems = ["dashboard", "import", "listening"].map((id) =>
  navItems.find((item) => item.id === id),
);

export default function Layout({
  route,
  navigate,
  settings,
  onToggleTheme,
  children,
  dueCount,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeId =
    route.page === "set" || route.page === "study" ? "library" : route.page;

  const go = (page) => {
    navigate(page);
    setMobileOpen(false);
  };

  return (
    <div className="app-shell">
      <button
        className="mobile-menu-button"
        onClick={() => setMobileOpen(true)}
        aria-label="Mở menu"
      >
        <Menu />
      </button>
      {mobileOpen && (
        <button
          className="sidebar-overlay"
          onClick={() => setMobileOpen(false)}
          aria-label="Đóng menu"
        />
      )}
      <aside className={`sidebar ${mobileOpen ? "sidebar--open" : ""}`}>
        <div className="sidebar__top">
          <button className="brand" onClick={() => go("dashboard")}>
            <span className="brand-mark">
              <BookOpen size={21} />
            </span>
            <span className="brand-name">
              Vocabloom<small>by NMC</small>
            </span>
          </button>
          <button
            className="icon-button sidebar__close"
            onClick={() => setMobileOpen(false)}
            aria-label="Đóng"
          >
            <X size={19} />
          </button>
        </div>

        <nav className="sidebar__nav" aria-label="Điều hướng chính">
          <span className="sidebar-label">KHÔNG GIAN HỌC</span>
          {navItems.map(({ id, label, icon: Icon, accent }) => (
            <button
              key={id}
              className={`nav-item ${activeId === id ? "nav-item--active" : ""} ${accent ? "nav-item--accent" : ""}`}
              onClick={() => go(id)}
              aria-current={activeId === id ? "page" : undefined}
            >
              <Icon size={19} />
              <span>{label}</span>
              {id === "dashboard" && dueCount > 0 && (
                <em>{dueCount > 99 ? "99+" : dueCount}</em>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-tip">
          <span>
            <Sparkles size={16} /> Mẹo nhỏ
          </span>
          <p>Ôn 10 phút mỗi ngày hiệu quả hơn học dồn một lần.</p>
        </div>

        <div className="sidebar__footer">
          <button className="theme-toggle" onClick={onToggleTheme}>
            {settings.theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            <span>
              {settings.theme === "dark" ? "Giao diện sáng" : "Giao diện tối"}
            </span>
          </button>
          <div className="local-badge">
            <span /> Dữ liệu được lưu cục bộ
          </div>
        </div>
      </aside>

      <main className="main-content">
        {(route.page === "set" || route.page === "study") && (
          <button
            className="back-button"
            onClick={() =>
              navigate(route.page === "study" ? `set/${route.id}` : "library")
            }
          >
            <ChevronLeft size={17} /> Quay lại
          </button>
        )}
        {children}
      </main>

      <nav className="mobile-nav" aria-label="Điều hướng di động">
        {mobileNavItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={activeId === id ? "active" : ""}
            onClick={() => go(id)}
            aria-current={activeId === id ? "page" : undefined}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
