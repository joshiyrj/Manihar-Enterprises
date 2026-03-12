import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAdminAuth } from "./useAdminAuth";
import AdminShell from "./components/AdminShell";

export default function AdminLayout() {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const { isLoading, isError, data, error } = useAdminAuth();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("admin_theme");
    const theme = stored === "dark" || stored === "light"
      ? stored
      : (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = theme;
  }, []);

  useEffect(() => {
    const onLogin = pathname === "/admin/login";
    if (!isLoading && isError && !onLogin) nav("/admin/login", { replace: true });
  }, [isLoading, isError, pathname, nav]);

  if (pathname === "/admin/login") return <div className="admin-theme"><Outlet /></div>;

  if (isLoading) {
    return (
      <div className="admin-theme min-h-screen grid place-items-center">
        <div className="card p-6 w-full max-w-md mx-4">
          <div className="skeleton h-5 w-36" />
          <div className="skeleton mt-3 h-4 w-64" />
          <div className="skeleton mt-6 h-10 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError) {
    const msg =
      error?.response?.data?.message ||
      error?.message ||
      "Could not connect to the backend service.";

    return (
      <div className="admin-theme min-h-screen grid place-items-center p-4">
        <div className="max-w-md w-full card p-6">
          <h1 className="text-lg font-semibold">Admin panel unavailable</h1>
          <p className="text-sm text-slate-600 mt-2">{msg}</p>
          <div className="mt-4 text-sm text-slate-700">
            Ensure backend API is running and reachable, then reload the page.
          </div>
          <button
            onClick={() => nav("/admin/login", { replace: true })}
            className="mt-5 w-full btn btn-primary"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <AdminShell admin={data}>
      <Outlet />
    </AdminShell>
  );
}
