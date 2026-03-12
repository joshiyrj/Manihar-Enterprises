import { useQuery } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import { Boxes, Layers, Link2, Tag, Clock, TrendingUp } from "lucide-react";

export default function AdminDashboardHome() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics-dashboard"],
    queryFn: async () => (await api.get("/api/analytics/dashboard")).data,
    refetchInterval: 30000
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Loading analytics...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card card-pad">
              <div className="h-4 w-20 bg-slate-200 rounded animate-pulse" />
              <div className="h-8 w-12 bg-slate-100 rounded animate-pulse mt-2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const stats = [
    {
      title: "Total Items",
      value: data?.totalItems || 0,
      sub: `${data?.activeItems || 0} active | ${data?.inactiveItems || 0} inactive`,
      icon: <Boxes size={20} className="text-indigo-600" />,
      tone: "indigo"
    },
    {
      title: "Collections",
      value: data?.totalCollections || 0,
      sub: `${data?.activeCollections || 0} active | ${data?.inactiveCollections || 0} inactive`,
      icon: <Layers size={20} className="text-violet-600" />,
      tone: "violet"
    },
    {
      title: "Avg Items/Collection",
      value: data?.totalCollections > 0
        ? (data?.totalItems / data?.totalCollections).toFixed(1)
        : "0",
      sub: "per collection",
      icon: <Link2 size={20} className="text-emerald-600" />,
      tone: "emerald"
    },
    {
      title: "Unique Tags",
      value: data?.totalTags || 0,
      sub: "across all entities",
      icon: <Tag size={20} className="text-amber-600" />,
      tone: "amber"
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <TrendingUp size={22} className="text-slate-400" />
          Dashboard
        </h1>
        <p className="page-subtitle">Operational overview for your workspace.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div
            key={i}
            className={`dashboard-stat-card tone-${s.tone}`}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-slate-600">{s.title}</div>
              {s.icon}
            </div>
            <div className="text-3xl font-bold text-slate-900 mt-2">{s.value}</div>
            <div className="text-xs text-slate-500 mt-1">{s.sub}</div>
          </div>
        ))}
      </div>

      {data?.recentActivity?.length > 0 && (
        <div className="card">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
            <Clock size={18} className="text-slate-500" />
            <h2 className="font-semibold text-slate-900">Recent Activity</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {data.recentActivity.map((act, i) => (
              <div key={i} className="px-5 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3 min-w-0">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${actionBadge(act.action)}`}>
                    {act.action}
                  </span>
                  <span className="text-sm text-slate-700 break-words">
                    {act.entityType && <span className="font-medium">{act.entityType}</span>}
                    {act.entityName && `: ${act.entityName}`}
                    {!act.entityType && !act.entityName && (act.details?.userMessage || "System action")}
                  </span>
                </div>
                <span className="text-xs text-slate-400 sm:whitespace-nowrap">{formatTimeAgo(act.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card p-5">
        <p className="text-sm text-slate-700">
          Use the admin panels to manage data, monitor activity, and export records.
        </p>
      </div>
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
    assistant: "badge-inactive"
  };
  return map[action] || "badge-inactive";
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
