import { useState } from "react";
import { Download, FileJson, FileSpreadsheet, History, Boxes, Layers } from "lucide-react";
import { api } from "../../../lib/api";

export default function AdminExport() {
    const [downloading, setDownloading] = useState(null);

    async function downloadExport(endpoint, filename) {
        setDownloading(filename);
        try {
            const response = await api.get(endpoint, {
                responseType: "blob"
            });
            const blob = response.data;
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            alert(`Export failed: ${e?.response?.data?.message || e.message || "Unknown error"}`);
        } finally {
            setDownloading(null);
        }
    }

    const exports = [
        {
            title: "Items - JSON",
            description: "Export all items with full details in JSON format",
            icon: <Boxes size={20} className="text-indigo-600" />,
            iconBg: "#eef2ff",
            fileIcon: <FileJson size={16} className="text-indigo-500" />,
            endpoint: "/api/export/items?format=json",
            filename: "items.json"
        },
        {
            title: "Items - CSV",
            description: "Export items as a spreadsheet-compatible CSV file",
            icon: <Boxes size={20} className="text-indigo-600" />,
            iconBg: "#eef2ff",
            fileIcon: <FileSpreadsheet size={16} className="text-emerald-500" />,
            endpoint: "/api/export/items?format=csv",
            filename: "items.csv"
        },
        {
            title: "Collections - JSON",
            description: "Export all collections in JSON format",
            icon: <Layers size={20} className="text-violet-600" />,
            iconBg: "#f5f3ff",
            fileIcon: <FileJson size={16} className="text-violet-500" />,
            endpoint: "/api/export/collections?format=json",
            filename: "collections.json"
        },
        {
            title: "Collections - CSV",
            description: "Export collections as a spreadsheet-compatible CSV file",
            icon: <Layers size={20} className="text-violet-600" />,
            iconBg: "#f5f3ff",
            fileIcon: <FileSpreadsheet size={16} className="text-emerald-500" />,
            endpoint: "/api/export/collections?format=csv",
            filename: "collections.csv"
        },
        {
            title: "Activity Log - JSON",
            description: "Export recent admin activity (up to 500 entries)",
            icon: <History size={20} className="text-amber-600" />,
            iconBg: "#fffbeb",
            fileIcon: <FileJson size={16} className="text-amber-500" />,
            endpoint: "/api/export/activity?format=json",
            filename: "activity_log.json"
        },
        {
            title: "Activity Log - CSV",
            description: "Export activity as a spreadsheet for auditing",
            icon: <History size={20} className="text-amber-600" />,
            iconBg: "#fffbeb",
            fileIcon: <FileSpreadsheet size={16} className="text-emerald-500" />,
            endpoint: "/api/export/activity?format=csv",
            filename: "activity_log.csv"
        }
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="page-title flex items-center gap-2">
                    <Download size={22} className="text-slate-400" />
                    Export Data
                </h1>
                <p className="page-subtitle">
                    Download your data in JSON or CSV format for backup, reporting, or migration.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {exports.map((exp) => (
                    <div
                        key={exp.filename}
                        className="card card-pad flex flex-col justify-between transition-transform hover:scale-[1.02] cursor-pointer"
                        onClick={() => downloadExport(exp.endpoint, exp.filename)}
                    >
                        <div>
                            <div className="flex items-center gap-3 mb-3">
                                <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                                    style={{ background: exp.iconBg }}
                                >
                                    {exp.icon}
                                </div>
                                <div>
                                    <div className="font-semibold text-slate-900 text-sm">{exp.title}</div>
                                    <div className="flex items-center gap-1 text-xs text-slate-500">
                                        {exp.fileIcon}
                                        {exp.filename}
                                    </div>
                                </div>
                            </div>
                            <p className="text-sm text-slate-600">{exp.description}</p>
                        </div>

                        <div className="mt-4">
                            <button
                                className="btn btn-ghost w-full"
                                disabled={downloading === exp.filename}
                            >
                                <Download size={16} />
                                {downloading === exp.filename ? "Downloading..." : "Download"}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
