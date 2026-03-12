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

    return (
        <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="page-title flex items-center gap-2">
                        <Clock size={22} className="text-slate-400" />
                        Activity Log
                    </h1>
                    <p className="page-subtitle">Track all admin actions and system events.</p>
                </div>

                <div className="flex items-center gap-2">
                    <Filter size={16} className="text-slate-400" />
                    <select
                        className="select"
                        value={actionFilter}
                        onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
                    >
                        <option value="">All Actions</option>
                        <option value="create">Create</option>
                        <option value="update">Update</option>
                        <option value="delete">Delete</option>
                        <option value="login">Login</option>
                        <option value="export">Export</option>
                        <option value="assistant">Assistant</option>
                    </select>
                </div>
            </div>

            {isLoading ? (
                <div className="card card-pad">Loading activity...</div>
            ) : (
                <>
                    <div className="table-wrap">
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
                                {(data?.rows || []).map((row, i) => (
                                    <tr key={i}>
                                        <td className="table-cell-status">
                                            <span className={`badge ${actionBadge(row.action)}`}>
                                                {row.action}
                                            </span>
                                        </td>
                                        <td><span className="table-cell-text text-slate-600">{row.entityType || "-"}</span></td>
                                        <td><span className="table-cell-text font-medium text-slate-900">{row.entityName || "-"}</span></td>
                                        <td><span className="table-cell-text text-slate-500 text-xs max-w-[200px] truncate">{row.details ? JSON.stringify(row.details).slice(0, 80) : "-"}</span></td>
                                        <td><span className="table-cell-text text-xs text-slate-400 whitespace-nowrap">{new Date(row.createdAt).toLocaleString()}</span></td>
                                    </tr>
                                ))}
                                {(!data?.rows || data.rows.length === 0) && (
                                    <tr>
                                        <td colSpan={5} className="text-slate-500">No activity found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {data?.pages > 1 && (
                        <div className="flex items-center justify-center gap-2">
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
        assistant: "action-badge-assistant",
        bulk_update: "action-badge-bulk_update",
        bulk_delete: "action-badge-bulk_delete"
    };
    return map[action] || "badge-inactive";
}
