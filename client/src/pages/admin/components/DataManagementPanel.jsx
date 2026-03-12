import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import {
    Plus, Search, ChevronUp, ChevronDown, Trash2, Edit3, X,
    ChevronLeft, ChevronRight, ToggleLeft, ToggleRight,
    AlertCircle, CheckCircle, PackageOpen, Upload, Download, FileSpreadsheet
} from "lucide-react";

function SortIcon({ activeSort, order, col }) {
    if (activeSort !== col) return <ChevronUp size={14} className="opacity-20" />;
    return order === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
}

function escapeCsvCell(value) {
    const text = String(value ?? "");
    if (!/[",\n]/.test(text)) return text;
    return `"${text.replace(/"/g, "\"\"")}"`;
}

function buildTemplateCsv(csvTemplate) {
    const headers = csvTemplate?.headers || [];
    const sampleRows = csvTemplate?.sampleRows || [];
    if (!headers.length) return "";
    return [headers, ...sampleRows]
        .map((row) => row.map(escapeCsvCell).join(","))
        .join("\n");
}

function toSingularLabel(text) {
    const label = String(text || "").trim();
    if (/ies$/i.test(label)) return label.replace(/ies$/i, "y");
    if (/s$/i.test(label)) return label.replace(/s$/i, "");
    return label;
}

function formatColumnValue(col, item) {
    const raw = item?.[col.key];
    if (raw === null || raw === undefined || raw === "") return "-";
    if (col.type === "number") {
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed.toLocaleString() : String(raw);
    }
    return String(raw);
}

/**
 * Unified CRUD management panel for ALL modules.
 *
 * @param {string}  title            — e.g. "Collections", "Mills"
 * @param {string}  subtitle         — Description text
 * @param {string}  apiBase          — e.g. "/api/mills", "/api/entities"
 * @param {string}  queryKey         — React Query key
 * @param {Array}   columns          — [{ key, label, required, type, placeholder }]
 * @param {Object}  defaultNewItem   — default field values for new item
 * @param {JSX}     icon             — Lucide icon element
 * @param {string}  identifierField  — main name field key (default "name")
 * @param {Array}   modalFields      — fields to show in create/edit modal (superset of columns)
 * @param {boolean} useEntityApi     — if true, uses /api/entities conventions
 * @param {string}  entityType       — "item" or "collection" when useEntityApi
 * @param {Function} renderExtraModal — optional render prop for extra modal fields
 * @param {boolean} showCollectionColumn — show collection column in table (items)
 */
export default function DataManagementPanel({
    title, subtitle, apiBase, queryKey, columns, defaultNewItem = {},
    icon, identifierField = "name", modalFields, useEntityApi = false,
    entityType, renderExtraModal, showCollectionColumn = false, csvTemplate = null
}) {
    const qc = useQueryClient();
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState("createdAt");
    const [order, setOrder] = useState("desc");
    const [page, setPage] = useState(1);
    const [limit] = useState(10);
    const [statusFilter, setStatusFilter] = useState("all");
    const [selected, setSelected] = useState(new Set());
    const singularTitle = toSingularLabel(title);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState("create"); // "create" or "edit"
    const [modalData, setModalData] = useState({ ...defaultNewItem });
    const [editingId, setEditingId] = useState(null);
    const [fieldErrors, setFieldErrors] = useState({});

    // Toast
    const [toasts, setToasts] = useState([]);
    const [isImportingCsv, setIsImportingCsv] = useState(false);
    const importFileRef = useRef(null);

    const addToast = useCallback((message, type = "success") => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, 300);
        }, 2500);
    }, []);

    // The fields shown in the modal (defaults to columns)
    const editableFields = modalFields || columns;

    // Fetch data
    const { data, isLoading } = useQuery({
        queryKey: [queryKey, search, sort, order, page, limit, statusFilter],
        queryFn: () => {
            if (useEntityApi) {
                const params = {
                    type: entityType,
                    q: search || undefined,
                    status: statusFilter !== "all" ? statusFilter : undefined,
                    sort: sort === "createdAt" ? (order === "desc" ? "newest" : "oldest") : undefined
                };
                return api.get(apiBase, { params }).then(r => {
                    const raw = r.data;
                    const rows = Array.isArray(raw) ? raw : (raw.rows || []);
                    return { items: rows, total: rows.length, totalPages: 1 };
                });
            }
            return api.get(apiBase, {
                params: { search, sort, order, page, limit, status: statusFilter }
            }).then(r => r.data);
        },
        placeholderData: (previousData) => previousData,
    });

    const items = data?.items || [];
    const total = data?.total || 0;
    const totalPages = data?.totalPages || 1;
    const emptyColSpan = columns.length + (showCollectionColumn ? 4 : 3);
    const selectedItems = items.filter((item) => selected.has(item._id));
    const hasSelectedActive = selectedItems.some((item) => item.status === "active");
    const hasSelectedInactive = selectedItems.some((item) => item.status === "inactive");

    // ─── Mutations ───
    const createMut = useMutation({
        mutationFn: (body) => api.post(apiBase, body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: [queryKey] });
            if (useEntityApi) {
                qc.invalidateQueries({ queryKey: ["entities"] });
                qc.invalidateQueries({ queryKey: ["collections"] });
            }
            closeModal();
            addToast(`${singularTitle} created successfully`);
        },
        onError: (e) => {
            const msg = e?.response?.data?.message || "Failed to create";
            addToast(msg, "error");
        }
    });

    const updateMut = useMutation({
        mutationFn: ({ id, body }) => api.put(`${apiBase}/${id}`, body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: [queryKey] });
            if (useEntityApi) {
                qc.invalidateQueries({ queryKey: ["entities"] });
                qc.invalidateQueries({ queryKey: ["collections"] });
            }
            closeModal();
            addToast(`${singularTitle} updated successfully`);
        },
        onError: (e) => {
            const msg = e?.response?.data?.message || "Failed to update";
            addToast(msg, "error");
        }
    });

    const deleteMut = useMutation({
        mutationFn: (id) => api.delete(`${apiBase}/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: [queryKey] });
            if (useEntityApi) {
                qc.invalidateQueries({ queryKey: ["entities"] });
                qc.invalidateQueries({ queryKey: ["collections"] });
            }
            addToast("Deleted successfully");
        },
        onError: (e) => {
            const msg = e?.response?.data?.message || "Failed to delete";
            addToast(msg, "error");
        }
    });

    const toggleStatusMut = useMutation({
        mutationFn: ({ id, currentStatus }) => {
            const newStatus = currentStatus === "active" ? "inactive" : "active";
            if (useEntityApi) {
                return api.put(`${apiBase}/${id}`, { status: newStatus });
            }
            return api.put(`${apiBase}/${id}`, { status: newStatus });
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: [queryKey] });
            if (useEntityApi) {
                qc.invalidateQueries({ queryKey: ["entities"] });
                qc.invalidateQueries({ queryKey: ["collections"] });
            }
            addToast("Status updated");
        },
        onError: (e) => {
            const msg = e?.response?.data?.message || "Failed to toggle status";
            addToast(msg, "error");
        }
    });

    const bulkDeleteMut = useMutation({
        mutationFn: (ids) => api.post(`${apiBase}/bulk/delete`, { ids }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: [queryKey] });
            if (useEntityApi) qc.invalidateQueries({ queryKey: ["entities"] });
            setSelected(new Set());
            addToast("Bulk delete completed");
        },
        onError: (e) => {
            const msg = e?.response?.data?.message || "Bulk delete failed";
            addToast(msg, "error");
        }
    });

    const bulkStatusMut = useMutation({
        mutationFn: ({ ids, status }) => api.post(`${apiBase}/bulk/status`, { ids, status }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: [queryKey] });
            if (useEntityApi) qc.invalidateQueries({ queryKey: ["entities"] });
            setSelected(new Set());
            addToast("Status updated");
        },
    });

    // ─── Handlers ───
    const toggleSort = useCallback((col) => {
        if (sort === col) setOrder(o => o === "asc" ? "desc" : "asc");
        else { setSort(col); setOrder("asc"); }
        setPage(1);
    }, [sort]);

    const toggleSelect = (id) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (selected.size === items.length) setSelected(new Set());
        else setSelected(new Set(items.map(i => i._id)));
    };

    const openCreate = () => {
        setModalMode("create");
        setModalData({ ...defaultNewItem });
        setEditingId(null);
        setFieldErrors({});
        setShowModal(true);
    };

    const openEdit = (item) => {
        setModalMode("edit");
        const d = {};
        editableFields.forEach(c => { d[c.key] = item[c.key] ?? ""; });
        d.status = item.status;
        if (item.tags) d.tags = Array.isArray(item.tags) ? item.tags.join(", ") : item.tags;
        if (item.description !== undefined) d.description = item.description;
        if (item.notes !== undefined) d.notes = item.notes;
        if (item.collectionId !== undefined) d.collectionId = item.collectionId || "";
        if (item.collectionName !== undefined) d.collectionName = item.collectionName || "";
        setEditingId(item._id);
        setFieldErrors({});
        setModalData(d);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingId(null);
        setFieldErrors({});
        setModalData({ ...defaultNewItem });
    };

    const validateFields = () => {
        const errors = {};
        const required = editableFields.filter(c => c.required);
        for (const r of required) {
            const val = modalData[r.key];
            if (!val?.toString().trim()) {
                errors[r.key] = `${r.label} is required`;
            }
        }
        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSave = () => {
        if (!validateFields()) return;

        const payload = { ...modalData };

        // Handle tags conversion
        if (typeof payload.tags === "string") {
            payload.tags = payload.tags.split(",").map(t => t.trim()).filter(Boolean);
        }

        if (useEntityApi) {
            payload.type = entityType;
            if (entityType === "item") {
                payload.collectionId = payload.collectionId || null;
                payload.collectionName = (payload.collectionName || "").trim();
                if (payload.collectionName) payload.collectionId = null;
            } else {
                payload.collectionId = null;
                payload.collectionName = "";
            }
        }

        if (modalMode === "create") {
            createMut.mutate(payload);
        } else {
            updateMut.mutate({ id: editingId, body: payload });
        }
    };

    const handleDelete = (item) => {
        if (!window.confirm(`Delete "${item[identifierField]}"?`)) return;
        deleteMut.mutate(item._id);
    };

    const handleToggleStatus = (item) => {
        toggleStatusMut.mutate({ id: item._id, currentStatus: item.status });
    };

    const handleBulkDelete = () => {
        if (!window.confirm(`Delete ${selected.size} selected items?`)) return;
        bulkDeleteMut.mutate([...selected]);
    };

    const downloadExampleCsv = () => {
        const csvContent = buildTemplateCsv(csvTemplate);
        if (!csvContent) {
            addToast("Example CSV template is not available for this module.", "error");
            return;
        }

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = csvTemplate?.filename || `${title.toLowerCase().replace(/\s+/g, "_")}_template.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const openImportDialog = () => {
        importFileRef.current?.click();
    };

    const handleCsvImport = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;

        const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type.includes("csv");
        if (!isCsv) {
            addToast("Please select a valid CSV file.", "error");
            return;
        }

        setIsImportingCsv(true);
        try {
            const csv = await file.text();
            if (!csv.trim()) {
                addToast("The selected CSV file is empty.", "error");
                return;
            }

            const payload = useEntityApi ? { type: entityType, csv } : { csv };
            const { data: result } = await api.post(`${apiBase}/bulk/import`, payload);

            qc.invalidateQueries({ queryKey: [queryKey] });
            if (useEntityApi) {
                qc.invalidateQueries({ queryKey: ["entities"] });
                qc.invalidateQueries({ queryKey: ["collections"] });
            }

            const imported = result?.imported ?? 0;
            const created = result?.created ?? 0;
            const updated = result?.updated ?? 0;
            const skipped = result?.skipped ?? 0;
            const message = `Imported ${imported} row(s): ${created} created, ${updated} updated${skipped ? `, ${skipped} skipped` : ""}.`;
            addToast(message, skipped ? "info" : "success");
        } catch (e) {
            const msg = e?.response?.data?.message || "CSV import failed";
            addToast(msg, "error");
        } finally {
            setIsImportingCsv(false);
        }
    };

    const updateModalField = (key, value) => {
        setModalData(prev => ({ ...prev, [key]: value }));
        // Clear field error on change
        if (fieldErrors[key]) {
            setFieldErrors(prev => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
        }
    };

    return (
        <div>
            {/* Toast Container */}
            {toasts.length > 0 && (
                <div className="toast-container">
                    {toasts.map(t => (
                        <div key={t.id} className={`toast toast-${t.type} ${t.exiting ? "toast-exit" : ""}`}>
                            {t.type === "success" && <CheckCircle size={16} />}
                            {t.type === "error" && <AlertCircle size={16} />}
                            {t.message}
                        </div>
                    ))}
                </div>
            )}

            {/* Header */}
            <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="page-title flex items-center gap-2">{icon} {title}</h1>
                    <p className="page-subtitle">{subtitle}</p>
                </div>
                <div className="flex w-full flex-wrap items-stretch gap-2 md:w-auto md:justify-end">
                    {csvTemplate?.headers?.length > 0 && (
                        <>
                            <input
                                ref={importFileRef}
                                type="file"
                                accept=".csv,text/csv"
                                className="hidden"
                                onChange={handleCsvImport}
                            />
                            <button onClick={downloadExampleCsv} className="btn btn-ghost w-full sm:w-auto">
                                <Download size={16} /> Example CSV
                            </button>
                            <button onClick={openImportDialog} className="btn btn-ghost w-full sm:w-auto" disabled={isImportingCsv}>
                                {isImportingCsv ? <FileSpreadsheet size={16} /> : <Upload size={16} />}
                                {isImportingCsv ? "Importing..." : "Import CSV"}
                            </button>
                        </>
                    )}
                    <button onClick={openCreate} className="btn btn-primary w-full sm:w-auto">
                        <Plus size={16} /> Add {singularTitle}
                    </button>
                </div>
            </div>

            {/* Search + Filters */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1 min-w-0">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        className="input pl-9"
                        placeholder={`Search ${title.toLowerCase()}...`}
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                    />
                </div>
                <select
                    className="select w-full sm:w-auto"
                    value={statusFilter}
                    onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                </select>
            </div>

            {/* Bulk Actions */}
            {selected.size > 0 && (
                <div className="bulk-banner flex-wrap"
                    style={{ animation: "slideUp 0.2s ease-out" }}>
                    <span className="bulk-banner-count">{selected.size} selected</span>
                    <div className="hidden sm:block flex-1" />
                    {hasSelectedInactive && (
                        <button onClick={() => bulkStatusMut.mutate({ ids: [...selected], status: "active" })} className="btn btn-sm bulk-btn-success rounded-lg w-full sm:w-auto">
                            <ToggleRight size={14} /> Activate
                        </button>
                    )}
                    {hasSelectedActive && (
                        <button onClick={() => bulkStatusMut.mutate({ ids: [...selected], status: "inactive" })} className="btn btn-sm bulk-btn-muted rounded-lg w-full sm:w-auto">
                            <ToggleLeft size={14} /> Deactivate
                        </button>
                    )}
                    <button onClick={handleBulkDelete} className="btn btn-sm bulk-btn-danger rounded-lg w-full sm:w-auto">
                        <Trash2 size={14} /> Delete
                    </button>
                    <button onClick={() => setSelected(new Set())} className="btn btn-sm text-slate-500 w-full sm:w-auto">
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
                <div className="card px-4 py-3 flex items-center justify-between gap-3">
                    <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                        <input
                            type="checkbox"
                            checked={items.length > 0 && selected.size === items.length}
                            onChange={toggleAll}
                        />
                        Select all
                    </label>
                    <span className="text-xs text-slate-500">{items.length} shown</span>
                </div>

                {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="card p-4 space-y-3">
                            <div className="skeleton h-5 w-32 rounded" />
                            <div className="skeleton h-4 w-full rounded" />
                            <div className="skeleton h-4 w-3/4 rounded" />
                            <div className="skeleton h-9 w-full rounded-xl" />
                        </div>
                    ))
                ) : items.length === 0 ? (
                    <div className="card p-6 text-center">
                        <PackageOpen size={36} className="mx-auto opacity-40" />
                        <p className="mt-2 font-medium text-slate-500">No {title.toLowerCase()} found</p>
                        <p className="text-xs mt-1 text-slate-500">Click "Add {singularTitle}" to create one.</p>
                    </div>
                ) : (
                    items.map(item => (
                        <article key={item._id} className="card p-4 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex items-start gap-2">
                                    <input
                                        type="checkbox"
                                        className="mt-1"
                                        checked={selected.has(item._id)}
                                        onChange={() => toggleSelect(item._id)}
                                    />
                                    <div className="min-w-0">
                                        <p className="text-[11px] uppercase tracking-wide text-slate-500">
                                            {columns.find(c => c.key === identifierField)?.label || "Name"}
                                        </p>
                                        <p className="font-semibold text-slate-900 break-words">{item[identifierField] || "-"}</p>
                                    </div>
                                </div>
                                <button
                                    className="status-toggle"
                                    onClick={() => handleToggleStatus(item)}
                                    title={`Click to ${item.status === "active" ? "deactivate" : "activate"}`}
                                    disabled={toggleStatusMut.isPending}
                                >
                                    <span className={`badge ${item.status === "active" ? "badge-active" : "badge-inactive"}`}>
                                        {item.status === "active" ? "Active" : "Inactive"}
                                    </span>
                                </button>
                            </div>

                            <div className="grid grid-cols-1 gap-2">
                                {columns.filter(col => col.key !== identifierField).map(col => (
                                    <div key={col.key} className="rounded-lg panel-muted-box border px-3 py-2">
                                        <p className="text-[11px] uppercase tracking-wide text-slate-500">{col.label}</p>
                                        <p className="text-sm text-slate-800 break-words">{formatColumnValue(col, item)}</p>
                                    </div>
                                ))}
                                {showCollectionColumn && (
                                    <div className="rounded-lg panel-muted-box border px-3 py-2">
                                        <p className="text-[11px] uppercase tracking-wide text-slate-500">Collection</p>
                                        <p className="text-sm text-slate-800 break-words">{item.collectionName || "Unassigned"}</p>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-1">
                                <button
                                    onClick={() => openEdit(item)}
                                    className="btn btn-ghost w-full"
                                    title="Edit"
                                >
                                    <Edit3 size={15} />
                                    Edit
                                </button>
                                <button
                                    onClick={() => handleDelete(item)}
                                    className="btn btn-danger w-full"
                                    title="Delete"
                                >
                                    <Trash2 size={15} />
                                    Delete
                                </button>
                            </div>
                        </article>
                    ))
                )}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block table-wrap -mx-1 sm:mx-0">
                <table>
                    <thead>
                        <tr>
                            <th className="w-10">
                                <input type="checkbox" checked={items.length > 0 && selected.size === items.length} onChange={toggleAll} />
                            </th>
                            {columns.map(col => (
                                <th key={col.key} onClick={() => toggleSort(col.key)} className="cursor-pointer select-none">
                                    <span className="table-head-label">
                                        {col.label} <SortIcon activeSort={sort} order={order} col={col.key} />
                                    </span>
                                </th>
                            ))}
                            {showCollectionColumn && (
                                <th onClick={() => toggleSort("collectionName")} className="cursor-pointer select-none">
                                    <span className="table-head-label">
                                        Collection <SortIcon activeSort={sort} order={order} col="collectionName" />
                                    </span>
                                </th>
                            )}
                            <th>Status</th>
                            <th className="w-[140px]">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i}>
                                    <td><div className="skeleton h-4 w-4 rounded" /></td>
                                    {columns.map(col => (
                                        <td key={col.key}><div className="skeleton h-4 w-32 rounded" /></td>
                                    ))}
                                    {showCollectionColumn && <td><div className="skeleton h-4 w-24 rounded" /></td>}
                                    <td><div className="skeleton h-6 w-16 rounded-full" /></td>
                                    <td><div className="skeleton h-8 w-20 rounded" /></td>
                                </tr>
                            ))
                        ) : items.length === 0 ? (
                            <tr>
                                <td colSpan={emptyColSpan} className="empty-state">
                                    <PackageOpen size={40} />
                                    <p className="font-medium text-slate-500">No {title.toLowerCase()} found</p>
                                    <p className="text-xs mt-1">Click "Add {singularTitle}" to create one.</p>
                                </td>
                            </tr>
                        ) : items.map(item => (
                            <tr key={item._id}>
                                <td>
                                    <input type="checkbox" checked={selected.has(item._id)} onChange={() => toggleSelect(item._id)} />
                                </td>
                                {columns.map(col => (
                                    <td key={col.key}>
                                        <span className={`table-cell-text ${col.key === identifierField ? "font-medium text-slate-900" : ""}`}>
                                            {formatColumnValue(col, item)}
                                        </span>
                                    </td>
                                ))}
                                {showCollectionColumn && (
                                    <td>
                                        <span className="table-cell-text text-slate-600">{item.collectionName || "Unassigned"}</span>
                                    </td>
                                )}
                                <td className="table-cell-status">
                                    <button
                                        className="status-toggle"
                                        onClick={() => handleToggleStatus(item)}
                                        title={`Click to ${item.status === "active" ? "deactivate" : "activate"}`}
                                        disabled={toggleStatusMut.isPending}
                                    >
                                        <span className={`badge ${item.status === "active" ? "badge-active" : "badge-inactive"}`}>
                                            {item.status === "active" ? "Active" : "Inactive"}
                                        </span>
                                    </button>
                                </td>
                                <td>
                                    <div className="table-cell-actions">
                                        <button onClick={() => openEdit(item)} className="icon-btn-edit p-1.5 rounded-lg transition-colors" title="Edit">
                                            <Edit3 size={15} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(item)}
                                            className="icon-btn-delete p-1.5 rounded-lg transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {!useEntityApi && totalPages > 1 && (
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-slate-500">
                        Showing {items.length} of {total} entries
                    </div>
                    <div className="text-xs text-slate-500 sm:hidden">
                        Page {page} of {totalPages}
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="btn btn-ghost text-xs py-1 px-2">
                            <ChevronLeft size={14} /> Prev
                        </button>
                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                            const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                            const p = start + i;
                            if (p > totalPages) return null;
                            return (
                                <button key={p} onClick={() => setPage(p)}
                                    className={`hidden sm:inline-flex btn text-xs py-1 px-3 ${p === page ? "btn-primary" : "btn-ghost"}`}
                                >{p}</button>
                            );
                        })}
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn btn-ghost text-xs py-1 px-2">
                            Next <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            )}

            {/* Entity API total count */}
            {useEntityApi && (
                <div className="mt-3 text-sm text-slate-500">
                    {total} {title.toLowerCase()} total
                </div>
            )}

            {/* Create / Edit Modal */}
            {showModal && (
                <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && closeModal()}>
                    <div className="modal max-h-[92vh] flex flex-col">
                        <div className="modal-header">
                            <div>
                                <h3 className="font-semibold text-slate-900">
                                    {modalMode === "create" ? "Create" : "Edit"} {singularTitle}
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {modalMode === "create" ? "Fill in the details below." : "Update the details and save."}
                                </p>
                            </div>
                            <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="modal-body space-y-4 overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {editableFields.filter(c => c.editable !== false).map(col => (
                                    <div key={col.key} className={col.fullWidth ? "md:col-span-2" : ""}>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            {col.label} {col.required && <span className="text-rose-500">*</span>}
                                        </label>
                                        {col.type === "textarea" ? (
                                            <textarea
                                                className={`input min-h-[80px] ${fieldErrors[col.key] ? "input-error" : ""}`}
                                                placeholder={col.placeholder || col.label}
                                                value={modalData[col.key] ?? ""}
                                                onChange={e => updateModalField(col.key, e.target.value)}
                                            />
                                        ) : col.type === "select" ? (
                                            <select
                                                className={`select ${fieldErrors[col.key] ? "input-error" : ""}`}
                                                value={modalData[col.key] ?? ""}
                                                onChange={e => updateModalField(col.key, e.target.value)}
                                            >
                                                {(col.options || []).map(opt => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <input
                                                className={`input ${fieldErrors[col.key] ? "input-error" : ""}`}
                                                type={col.type || "text"}
                                                placeholder={col.placeholder || col.label}
                                                value={modalData[col.key] ?? ""}
                                                onChange={e => updateModalField(col.key, e.target.value)}
                                            />
                                        )}
                                        {fieldErrors[col.key] && (
                                            <p className="field-error">{fieldErrors[col.key]}</p>
                                        )}
                                    </div>
                                ))}

                                {/* Status selector */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                                    <select
                                        className="select"
                                        value={modalData.status || "active"}
                                        onChange={e => updateModalField("status", e.target.value)}
                                    >
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </div>
                            </div>

                            {/* Extra modal content (e.g. collection link for items) */}
                            {renderExtraModal && renderExtraModal({ modalData, updateModalField, fieldErrors, modalMode })}

                            {/* Notes / Description — always present */}
                            {!editableFields.some(f => f.key === "description" || f.key === "notes") && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        {useEntityApi ? "Description" : "Notes"}
                                    </label>
                                    <textarea
                                        className="input min-h-[70px]"
                                        placeholder="Optional notes..."
                                        value={modalData[useEntityApi ? "description" : "notes"] || ""}
                                        onChange={e => updateModalField(useEntityApi ? "description" : "notes", e.target.value)}
                                    />
                                </div>
                            )}
                        </div>
                        <div className="modal-footer flex-col-reverse sm:flex-row">
                            <button onClick={closeModal} className="btn btn-ghost w-full sm:w-auto">Cancel</button>
                            <button
                                onClick={handleSave}
                                disabled={createMut.isPending || updateMut.isPending}
                                className="btn btn-primary w-full sm:w-auto"
                            >
                                {(createMut.isPending || updateMut.isPending) ? (
                                    <>Saving...</>
                                ) : modalMode === "create" ? (
                                    <>Create</>
                                ) : (
                                    <>Save Changes</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
