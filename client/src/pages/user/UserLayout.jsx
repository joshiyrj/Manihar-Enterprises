import { Outlet, useLocation, useNavigate, NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import { useUserAuth } from "./useUserAuth";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { User, LogOut, Menu, X } from "lucide-react";

export default function UserLayout() {
    const { pathname } = useLocation();
    const nav = useNavigate();
    const qc = useQueryClient();
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const { isLoading, isError, data } = useUserAuth();

    useEffect(() => {
        const isAuthRoute = pathname === "/user/login";
        if (!isLoading && isError && !isAuthRoute) nav("/user/login", { replace: true });
    }, [isLoading, isError, pathname, nav]);

    useEffect(() => {
        if (typeof document === "undefined") return undefined;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = mobileNavOpen ? "hidden" : "";
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [mobileNavOpen]);

    if (pathname === "/user/login") return <Outlet />;

    if (isLoading) {
        return (
            <div className="min-h-screen grid place-items-center">
                <div className="card p-6 text-sm text-slate-600">Loading your workspace...</div>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="min-h-screen grid place-items-center p-4">
                <div className="card p-6 max-w-md w-full">
                    <p className="text-sm text-slate-700">Session not available. Please sign in again.</p>
                    <button onClick={() => nav("/user/login", { replace: true })} className="btn btn-primary mt-4 w-full">Go to Login</button>
                </div>
            </div>
        );
    }

    const logout = async () => {
        await api.post("/api/users/logout");
        qc.invalidateQueries({ queryKey: ["user-me"] });
        nav("/user/login", { replace: true });
    };

    return (
        <div className="app-shell">
            <div className="flex min-h-screen">
                <aside
                    className={[
                        "fixed inset-y-0 left-0 z-40 w-[260px] bg-white border-r border-slate-200 flex flex-col",
                        "transform transition-transform duration-200 ease-out md:static md:translate-x-0",
                        mobileNavOpen ? "translate-x-0" : "-translate-x-full"
                    ].join(" ")}
                >
                    <div className="p-5 border-b border-slate-200">
                        <div className="text-lg font-semibold">S Management</div>
                        <div className="text-xs text-slate-500 mt-1">User Portal</div>
                    </div>
                    <nav className="p-3 space-y-1 flex-1">
                        <NavLink
                            to="/user"
                            end
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors ${isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"}`
                            }
                            onClick={() => setMobileNavOpen(false)}
                        >
                            <User size={18} /> <span className="font-medium">My Profile</span>
                        </NavLink>
                    </nav>
                    <div className="p-3 border-t border-slate-200">
                        <button onClick={logout} className="w-full flex items-center justify-center gap-2 rounded-xl border bg-white px-3 py-2 hover:bg-slate-50 text-sm text-slate-700 transition-colors">
                            <LogOut size={18} /> Logout
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
                    <div className="min-h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 py-3 sm:px-6">
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
                                Welcome, <span className="font-semibold text-slate-900">{data?.name}</span>
                            </div>
                        </div>
                        <div className="hidden sm:block text-xs text-slate-500 max-w-[220px] truncate">{data?.email}</div>
                    </div>
                    <div className="p-4 sm:p-6"><Outlet /></div>
                </main>
            </div>
        </div>
    );
}
