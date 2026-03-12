import { useQuery } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import { useState } from "react";
import { Clock, Filter } from "lucide-react";

export default function AdminActivity() {
    const [page, setPage] = useState(1);
    const [actionFilter, setActionFilter] = useState("");

    const { data, isLoading } = useQuery({
        queryKey: ["activity-log", page, actionFilter],
        queryFn: async () => {
            const params = { page, limit: 20 };
            if (actionFilter) params.action = actionFilter;
            return (await api.get("/api/analytics/activity", { params })).data;
        }
    });
    const rows = data?.rows || [];

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="page-title flex items-center gap-2">
                        <Clock size={22} className="text-slate-400" />
                        Activity Log
                    </h1>
                    <p className="page-subtitle">Track all admin actions and system events.</p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Filter size={16} className="text-slate-400" />
                    <select
                        className="select w-full sm:w-auto"
                        value={actionFilter}
                        onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
                    >
                        <option value="">All Actions</option>
                        <option value="create">Create</option>
                        <option value="update">Update</option>
                        <option value="delete">Delete</option>
                        <option value="login">Login</option>
                        <option value="export">Export</option>
                    </select>
                </div>
            </div>

            {isLoading ? (
                <div className="card card-pad">Loading activity...</div>
            ) : (
                <>
                    <div className="md:hidden space-y-3">
                        {rows.map((row, i) => (
                            <article key={i} className="card p-4 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <span className={`badge ${actionBadge(row.action)}`}>
                                        {row.action}
                                    </span>
                                    <span className="text-xs text-slate-400">{formatDate(row.createdAt)}</span>
                                </div>
                                <div className="text-sm text-slate-700">
                                    <span className="font-medium">{row.entityType || "System"}</span>
                                    {row.entityName ? `: ${row.entityName}` : ""}
                                </div>
                                <p className="text-xs text-slate-500 break-words">
                                    {summarizeDetails(row.details)}
                                </p>
                            </article>
                        ))}
                        {rows.length === 0 && (
                            <div className="card p-6 text-center text-slate-500 text-sm">
                                No activity found.
                            </div>
                        )}
                    </div>

                    <div className="hidden md:block table-wrap -mx-1 sm:mx-0">
                        <table>
                            <thead>
                                <tr>
                                    <th>Action</th>
                                    <th>Entity</th>
                                    <th>Name</th>
                                    <th>Details</th>
                                    <th>Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, i) => (
                                    <tr key={i}>
                                        <td className="table-cell-status">
                                            <span className={`badge ${actionBadge(row.action)}`}>
                                                {row.action}
                                            </span>
                                        </td>
                                        <td><span className="table-cell-text text-slate-600">{row.entityType || "-"}</span></td>
                                        <td><span className="table-cell-text font-medium text-slate-900">{row.entityName || "-"}</span></td>
                                        <td><span className="table-cell-text text-slate-500 text-xs max-w-[260px] truncate" title={summarizeDetails(row.details)}>{summarizeDetails(row.details)}</span></td>
                                        <td><span className="table-cell-text text-xs text-slate-400 whitespace-nowrap">{formatDate(row.createdAt)}</span></td>
                                    </tr>
                                ))}
                                {rows.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="empty-state">No activity found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {data?.pages > 1 && (
                        <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
                            <button
                                className="btn btn-ghost"
                                disabled={page <= 1}
                                onClick={() => setPage((p) => p - 1)}
                            >
                                Previous
                            </button>
                            <span className="text-sm text-slate-600">
                                Page {page} of {data.pages}
                            </span>
                            <button
                                className="btn btn-ghost"
                                disabled={page >= data.pages}
                                onClick={() => setPage((p) => p + 1)}
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function actionBadge(action) {
    const map = {
        create: "badge-active",
        update: "action-badge-update",
        delete: "action-badge-delete",
        login: "action-badge-login",
        logout: "badge-inactive",
        export: "action-badge-export",
        assistant: "badge-inactive",
        bulk_update: "action-badge-bulk_update",
        bulk_delete: "action-badge-bulk_delete"
    };
    return map[action] || "badge-inactive";
}

function summarizeDetails(details) {
    if (!details) return "-";
    const text = typeof details === "string" ? details : JSON.stringify(details);
    return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}

function formatDate(value) {
    if (!value) return "-";
    return new Date(value).toLocaleString();
}
