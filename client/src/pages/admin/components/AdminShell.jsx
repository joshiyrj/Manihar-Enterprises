import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, Boxes, Layers, User, LogOut, BarChart3, Download, Factory, BoxSelect, Paintbrush, Moon, Sun } from "lucide-react";
import DigitalAssistant from "../assistant/DigitalAssistant";

export default function AdminShell({ admin, children }) {
  const nav = useNavigate();
  const qc = useQueryClient();
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

  async function logout() {
    await api.post("/api/auth/logout");
    qc.invalidateQueries({ queryKey: ["admin-me"] });
    nav("/admin/login", { replace: true });
  }

  return (
    <div className={`app-shell admin-theme admin-theme-${theme}`}>
      <div className="flex">
        <aside className="admin-sidebar w-[260px] min-h-screen border-r flex flex-col">
          <div className="p-5 border-b border-slate-200">
            <div className="admin-sidebar-brand text-lg font-semibold">S Management</div>
            <div className="admin-sidebar-meta text-xs mt-1">Admin Panel</div>
          </div>

          <nav className="p-3 space-y-1 flex-1">
            <SideLink to="/admin" icon={<LayoutDashboard size={18} />} end>Dashboard</SideLink>
            <SideLink to="/admin/items" icon={<Boxes size={18} />}>Items</SideLink>
            <SideLink to="/admin/collections" icon={<Layers size={18} />}>Collections</SideLink>
            <SideLink to="/admin/mills" icon={<Factory size={18} />}>Mills</SideLink>
            <SideLink to="/admin/quantities" icon={<BoxSelect size={18} />}>Quantities</SideLink>
            <SideLink to="/admin/design-nos" icon={<Paintbrush size={18} />}>Design Nos</SideLink>
            <SideLink to="/admin/profile" icon={<User size={18} />}>Profile</SideLink>
            <SideLink to="/admin/activity" icon={<BarChart3 size={18} />}>Activity Log</SideLink>
            <SideLink to="/admin/export" icon={<Download size={18} />}>Export Data</SideLink>
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

        <main className="flex-1">
          <div className="admin-topbar h-16 border-b flex items-center justify-between px-6">
            <div className="text-sm text-slate-600">
              Welcome, <span className="font-semibold text-slate-900">{admin?.name || "Admin"}</span>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                className="theme-toggle"
                onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}
                aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              >
                <span className={`theme-toggle-option ${theme === "light" ? "theme-toggle-option-active" : ""}`}>
                  <Sun size={14} />
                  Light
                </span>
                <span className={`theme-toggle-option ${theme === "dark" ? "theme-toggle-option-active" : ""}`}>
                  <Moon size={14} />
                  Dark
                </span>
              </button>
              <div className="text-xs text-slate-500">{admin?.email || ""}</div>
            </div>
          </div>

          <div className="p-6">{children}</div>
        </main>
      </div>

      <DigitalAssistant />
    </div>
  );
}

function SideLink({ to, icon, children, end }) {
  return (
    <NavLink
      to={to}
      end={end}
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
