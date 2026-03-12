import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, Boxes, Layers, User, LogOut, BarChart3, Download, Factory, BoxSelect, Paintbrush, Moon, Sun, Menu, X, ChevronDown, ChevronRight } from "lucide-react";
// Chatbot widget disabled.
// import DigitalAssistant from "../assistant/DigitalAssistant";

const NAV_GROUPS = [
  {
    id: "overview",
    label: "Overview",
    links: [
      { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true }
    ]
  },
  {
    id: "catalog",
    label: "Catalog",
    links: [
      { to: "/admin/items", label: "Items", icon: Boxes },
      { to: "/admin/collections", label: "Collections", icon: Layers },
      { to: "/admin/mills", label: "Mills", icon: Factory },
      { to: "/admin/quantities", label: "Quantities", icon: BoxSelect },
      { to: "/admin/design-nos", label: "Design Nos", icon: Paintbrush }
    ]
  },
  {
    id: "account",
    label: "Account",
    links: [
      { to: "/admin/profile", label: "Profile", icon: User },
      { to: "/admin/activity", label: "Activity Log", icon: BarChart3 },
      { to: "/admin/export", label: "Export Data", icon: Download }
    ]
  }
];

const ALL_NAV_LINKS = NAV_GROUPS.flatMap((group) => group.links);

export default function AdminShell({ admin, children }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileSectionsOpen, setMobileSectionsOpen] = useState(() =>
    Object.fromEntries(NAV_GROUPS.map((group) => [group.id, true]))
  );
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "light";
    const stored = window.localStorage.getItem("admin_theme");
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("admin_theme", theme);
  }, [theme]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = mobileNavOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileNavOpen]);

  const toggleSection = (id) => {
    setMobileSectionsOpen((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  async function logout() {
    await api.post("/api/auth/logout");
    qc.invalidateQueries({ queryKey: ["admin-me"] });
    nav("/admin/login", { replace: true });
  }

  return (
    <div className={`app-shell admin-theme admin-theme-${theme}`}>
      <div className="flex min-h-screen">
        <aside
          className={[
            "admin-sidebar fixed inset-y-0 left-0 z-40 w-[260px] border-r flex flex-col",
            "transform transition-transform duration-200 ease-out md:static md:translate-x-0",
            mobileNavOpen ? "translate-x-0" : "-translate-x-full"
          ].join(" ")}
        >
          <div className="p-5 border-b border-slate-200">
            <div className="admin-sidebar-brand text-lg font-semibold">S Management</div>
            <div className="admin-sidebar-meta text-xs mt-1">Admin Panel</div>
          </div>

          <nav className="p-3 flex-1 overflow-y-auto">
            <div className="hidden md:block space-y-1">
              {ALL_NAV_LINKS.map((link) => {
                const Icon = link.icon;
                return (
                  <SideLink
                    key={link.to}
                    to={link.to}
                    icon={<Icon size={18} />}
                    onClick={() => setMobileNavOpen(false)}
                    end={link.end}
                  >
                    {link.label}
                  </SideLink>
                );
              })}
            </div>

            <div className="md:hidden space-y-2">
              {NAV_GROUPS.map((group) => (
                <div key={group.id} className="panel-muted-box rounded-xl border">
                  <button
                    type="button"
                    onClick={() => toggleSection(group.id)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm font-semibold text-slate-700"
                    aria-expanded={Boolean(mobileSectionsOpen[group.id])}
                    aria-controls={`mobile-group-${group.id}`}
                  >
                    <span>{group.label}</span>
                    {mobileSectionsOpen[group.id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>

                  {mobileSectionsOpen[group.id] && (
                    <div id={`mobile-group-${group.id}`} className="px-2 pb-2 space-y-1">
                      {group.links.map((link) => {
                        const Icon = link.icon;
                        return (
                          <SideLink
                            key={link.to}
                            to={link.to}
                            icon={<Icon size={18} />}
                            onClick={() => setMobileNavOpen(false)}
                            end={link.end}
                          >
                            {link.label}
                          </SideLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </nav>

          <div className="p-3 border-t border-slate-200">
            <button
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors btn-ghost"
            >
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </aside>

        {mobileNavOpen && (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-slate-950/30 backdrop-blur-[1px] md:hidden"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation menu"
          />
        )}

        <main className="flex-1 min-w-0">
          <div className="admin-topbar min-h-16 border-b flex items-center justify-between px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 md:hidden"
                onClick={() => setMobileNavOpen((open) => !open)}
                aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
              >
                {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
              <div className="text-sm text-slate-600 truncate">
                Welcome, <span className="font-semibold text-slate-900">{admin?.name || "Admin"}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <button
                type="button"
                className="theme-toggle shrink-0"
                onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}
                aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              >
                <span className={`theme-toggle-option ${theme === "light" ? "theme-toggle-option-active" : ""}`}>
                  <Sun size={14} />
                  <span className="hidden sm:inline">Light</span>
                </span>
                <span className={`theme-toggle-option ${theme === "dark" ? "theme-toggle-option-active" : ""}`}>
                  <Moon size={14} />
                  <span className="hidden sm:inline">Dark</span>
                </span>
              </button>
              <div className="hidden sm:block text-xs text-slate-500 max-w-[220px] truncate">{admin?.email || ""}</div>
            </div>
          </div>

          <div className="p-4 sm:p-6">{children}</div>
        </main>
      </div>
      {/* Chatbot widget disabled. */}
      {/* <DigitalAssistant /> */}
    </div>
  );
}

function SideLink({ to, icon, children, end, onClick }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        [
          "admin-nav-link",
          isActive ? "admin-nav-link-active" : ""
        ].join(" ")
      }
    >
      {icon}
      <span className="font-medium">{children}</span>
    </NavLink>
  );
}
