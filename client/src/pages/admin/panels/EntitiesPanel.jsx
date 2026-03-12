import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import { Plus, Pencil, Trash2, X, FolderPlus, Layers, Boxes } from "lucide-react";

const STATUS_OPTIONS = ["active", "inactive"];
const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" }
];

function emptyEntity(type) {
  return {
    type,
    name: "",
    description: "",
    status: "active",
    tags: "",
    collectionId: "",
    collectionName: ""
  };
}

function parseTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  return String(tags)
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function formatTags(tags) {
  if (!tags) return "";
  if (Array.isArray(tags)) return tags.join(", ");
  return String(tags);
}

export default function EntitiesPanel({ type, title }) {
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("newest");
  const [groupByCollection, setGroupByCollection] = useState(type === "item");
  const [collectionFilter, setCollectionFilter] = useState("");

  const [toast, setToast] = useState(null);
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const modalInitial = { open: false, mode: "create", entity: emptyEntity(type) };
  const [modal, setModal] = useState(modalInitial);

  const collectionsQuery = useQuery({
    queryKey: ["collections"],
    enabled: type === "item",
    queryFn: async () => (await api.get("/api/entities/collections")).data
  });

  const listQuery = useQuery({
    queryKey: ["entities", { type, q, status, sort, collectionFilter }],
    queryFn: async () => {
      const params = {
        type,
        q: q || undefined,
        status: status || undefined,
        sort: sort || undefined
      };
      if (type === "item" && collectionFilter) params.collectionId = collectionFilter;

      const { data } = await api.get("/api/entities", { params });
      return Array.isArray(data) ? { rows: data } : data;
    }
  });

  const rows = useMemo(() => listQuery.data?.rows || [], [listQuery.data?.rows]);

  const grouped = useMemo(() => {
    if (type !== "item" || !groupByCollection) return null;
    const acc = {};
    for (const it of rows) {
      const key = (it.collectionName || "Unassigned").trim() || "Unassigned";
      if (!acc[key]) acc[key] = [];
      acc[key].push(it);
    }
    return acc;
  }, [rows, type, groupByCollection]);

  function openCreate() {
    setModal({ open: true, mode: "create", entity: emptyEntity(type) });
  }

  function openEdit(row) {
    setModal({
      open: true,
      mode: "edit",
      entity: {
        ...row,
        tags: formatTags(row.tags),
        collectionId: row.collectionId || "",
        collectionName: row.collectionName || ""
      }
    });
  }

  async function save() {
    const payload = {
      ...modal.entity,
      type,
      tags: parseTags(modal.entity.tags)
    };

    if (type === "item") {
      payload.collectionId = payload.collectionId || null;
      payload.collectionName = (payload.collectionName || "").trim();
      if (payload.collectionName) payload.collectionId = null;
    } else {
      payload.collectionId = null;
      payload.collectionName = "";
    }

    if (!payload.name?.trim()) {
      showToast("Name is required");
      return;
    }

    if (modal.mode === "create") {
      await api.post("/api/entities", payload);
      showToast(`${title.slice(0, -1)} created`);
    } else {
      await api.put(`/api/entities/${modal.entity._id}`, payload);
      showToast(`${title.slice(0, -1)} updated`);
    }

    setModal(modalInitial);
    await qc.invalidateQueries({ queryKey: ["entities"] });
    await qc.invalidateQueries({ queryKey: ["collections"] });
  }

  async function remove(id) {
    if (!confirm("Delete this entry?")) return;
    try {
      await api.delete(`/api/entities/${id}`);
      showToast("Deleted");
      await qc.invalidateQueries({ queryKey: ["entities"] });
      await qc.invalidateQueries({ queryKey: ["collections"] });
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || "Could not delete";
      showToast(msg);
    }
  }

  const icon = type === "item" ? <Boxes size={18} /> : <Layers size={18} />;

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed top-4 right-4 z-[60]">
          <div className="card px-4 py-3 text-sm text-slate-800 shadow-md">{toast}</div>
        </div>
      )}

      <div className="card card-pad">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-slate-900">{icon}</span>
              <h1 className="page-title">{title}</h1>
            </div>
            <p className="page-subtitle">Search, filter, create and edit {title.toLowerCase()}.</p>
          </div>

          <button onClick={openCreate} className="btn btn-primary">
            <Plus size={18} />
            Add {title.slice(0, -1)}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <input
              className="input"
              placeholder={`Search ${title.toLowerCase()}...`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Status</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === "active" ? "Active" : "Inactive"}
              </option>
            ))}
          </select>

          <select className="select" value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                Sort: {s.label}
              </option>
            ))}
          </select>
        </div>

        {type === "item" && (
          <div className="mt-3 flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex-1">
              <label className="text-xs text-slate-600">Filter by Collection</label>
              <select
                className="select mt-1"
                value={collectionFilter}
                onChange={(e) => setCollectionFilter(e.target.value)}
              >
                <option value="">All Collections</option>
                {(collectionsQuery.data || []).map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
                <option value="__none__">Unassigned</option>
              </select>
            </div>

            <div className="flex items-center gap-2 mt-6 md:mt-0">
              <input
                type="checkbox"
                checked={groupByCollection}
                onChange={(e) => setGroupByCollection(e.target.checked)}
              />
              <span className="text-sm text-slate-700">Group by Collection</span>
            </div>
          </div>
        )}
      </div>

      {listQuery.isLoading && <div className="card card-pad">Loading...</div>}
      {listQuery.isError && (
        <div className="card card-pad text-rose-700">
          {listQuery.error?.response?.data?.message || listQuery.error?.message || "Failed to load"}
        </div>
      )}

      {type === "item" && groupByCollection && grouped && !listQuery.isLoading && (
        <div className="space-y-4">
          {Object.keys(grouped)
            .sort((a, b) => a.localeCompare(b))
            .map((groupName) => (
              <div key={groupName} className="card">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers size={18} className="text-slate-700" />
                    <div className="font-semibold text-slate-900">{groupName}</div>
                    <span className="text-xs text-slate-500">({grouped[groupName].length})</span>
                  </div>
                </div>

                <div className="table-wrap rounded-none border-0">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Status</th>
                        <th className="w-[180px]">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grouped[groupName].map((r) => (
                        <tr key={r._id}>
                          <td><span className="table-cell-text font-medium text-slate-900">{r.name}</span></td>
                          <td className="table-cell-status">
                            <span className={"badge " + (r.status === "active" ? "badge-active" : "badge-inactive")}>
                              {r.status === "active" ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td>
                            <div className="table-cell-actions">
                              <button className="btn btn-ghost px-3 py-1.5" onClick={() => openEdit(r)}>
                                <Pencil size={16} /> Edit
                              </button>
                              <button className="btn btn-danger px-3 py-1.5" onClick={() => remove(r._id)}>
                                <Trash2 size={16} /> Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {grouped[groupName].length === 0 && (
                        <tr>
                          <td colSpan={3} className="text-slate-500">
                            No items.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
        </div>
      )}

      {(!groupByCollection || type !== "item") && !listQuery.isLoading && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                {type === "item" && <th>Collection</th>}
                <th>Status</th>
                <th className="w-[180px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id}>
                  <td><span className="table-cell-text font-medium text-slate-900">{r.name}</span></td>
                  {type === "item" && (
                    <td>
                      <span className="table-cell-text text-slate-700">{r.collectionName || "Unassigned"}</span>
                    </td>
                  )}
                  <td className="table-cell-status">
                    <span className={"badge " + (r.status === "active" ? "badge-active" : "badge-inactive")}>
                      {r.status === "active" ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <div className="table-cell-actions">
                      <button className="btn btn-ghost px-3 py-1.5" onClick={() => openEdit(r)}>
                        <Pencil size={16} /> Edit
                      </button>
                      <button className="btn btn-danger px-3 py-1.5" onClick={() => remove(r._id)}>
                        <Trash2 size={16} /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={type === "item" ? 4 : 3} className="text-slate-500">
                    No results.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modal.open && (
        <div className="modal-backdrop" onMouseDown={() => setModal(modalInitial)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="font-semibold text-slate-900">
                  {modal.mode === "create" ? "Create" : "Edit"} {title.slice(0, -1)}
                </div>
                <div className="text-xs text-slate-500">Update the details and save.</div>
              </div>
              <button className="btn btn-ghost px-3" onClick={() => setModal(modalInitial)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-600">Name *</label>
                  <input
                    className="input mt-1"
                    value={modal.entity.name}
                    onChange={(e) => setModal((m) => ({ ...m, entity: { ...m.entity, name: e.target.value } }))}
                    placeholder="e.g. Premium Item"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-600">Status</label>
                  <select
                    className="select mt-1"
                    value={modal.entity.status}
                    onChange={(e) => setModal((m) => ({ ...m, entity: { ...m.entity, status: e.target.value } }))}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s === "active" ? "Active" : "Inactive"}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-600">Tags (comma separated)</label>
                  <input
                    className="input mt-1"
                    value={modal.entity.tags}
                    onChange={(e) => setModal((m) => ({ ...m, entity: { ...m.entity, tags: e.target.value } }))}
                    placeholder="e.g. featured, new, sale"
                  />
                </div>
              </div>

              {type === "item" && (
                <div className="card card-pad">
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    <FolderPlus size={18} />
                    Collection Link
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Choose an existing collection or type a new one.
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-600">Select Existing</label>
                      <select
                        className="select mt-1"
                        value={modal.entity.collectionId || ""}
                        onChange={(e) => {
                          const id = e.target.value || "";
                          const selected = (collectionsQuery.data || []).find((c) => c._id === id);
                          setModal((m) => ({
                            ...m,
                            entity: {
                              ...m.entity,
                              collectionId: id,
                              collectionName: selected ? selected.name : m.entity.collectionName
                            }
                          }));
                        }}
                      >
                        <option value="">- Unassigned -</option>
                        {(collectionsQuery.data || []).map((c) => (
                          <option key={c._id} value={c._id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-slate-600">Or Create New</label>
                      <input
                        className="input mt-1"
                        value={modal.entity.collectionName || ""}
                        onChange={(e) =>
                          setModal((m) => ({
                            ...m,
                            entity: {
                              ...m.entity,
                              collectionName: e.target.value,
                              collectionId: ""
                            }
                          }))
                        }
                        placeholder="e.g. Summer Collection"
                      />
                      <div className="text-[11px] text-slate-500 mt-1">If this name does not exist, it will be created.</div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs text-slate-600">Description</label>
                <textarea
                  className="input mt-1 min-h-[90px]"
                  value={modal.entity.description}
                  onChange={(e) =>
                    setModal((m) => ({ ...m, entity: { ...m.entity, description: e.target.value } }))
                  }
                  placeholder="Optional notes..."
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(modalInitial)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={save}>
                {modal.mode === "create" ? "Create" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
