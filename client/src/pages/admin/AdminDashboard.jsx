import { useState } from "react";
import { api } from "../../lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, User, Layers, Boxes } from "lucide-react";

import ProfilePanel from "./panels/ProfilePanel";
import EntitiesPanel from "./panels/EntitiesPanel";

export default function AdminDashboard() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("profile"); // profile | items | collections

  async function logout() {
    await api.post("/api/auth/logout");
    qc.invalidateQueries({ queryKey: ["admin-me"] });
    window.location.href = "/admin/login";
  }

  return (
    <div className="min-h-screen bg-[#f6f7fb]">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Admin Panel</h1>
            <p className="text-slate-500">Manage Profile, Items &amp; Collections</p>
          </div>
          <button
            onClick={logout}
            className="btn btn-ghost"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4">
          <aside className="card card-pad space-y-1">
            <NavButton icon={<User size={18} />} active={tab === "profile"} onClick={() => setTab("profile")}>
              Profile
            </NavButton>
            <NavButton icon={<Boxes size={18} />} active={tab === "items"} onClick={() => setTab("items")}>
              Items
            </NavButton>
            <NavButton icon={<Layers size={18} />} active={tab === "collections"} onClick={() => setTab("collections")}>
              Collections
            </NavButton>
          </aside>

          <main className="card card-pad">
            {tab === "profile" && <ProfilePanel />}
            {tab === "items" && <EntitiesPanel type="item" title="Items" />}
            {tab === "collections" && <EntitiesPanel type="collection" title="Collections" />}
          </main>
        </div>
      </div>
    </div>
  );
}

function NavButton({ icon, active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={[
        "w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-sm transition-colors",
        active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
      ].join(" ")}
    >
      {icon}
      <span className="font-medium">{children}</span>
    </button>
  );
}