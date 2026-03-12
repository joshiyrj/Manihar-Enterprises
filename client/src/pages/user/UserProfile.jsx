import { useState, useEffect } from "react";
import { useUserAuth } from "./useUserAuth";
import { api } from "../../lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { User, Mail, Phone, Lock, CheckCircle2, AlertCircle } from "lucide-react";

export default function UserProfile() {
    const qc = useQueryClient();
    const { data: user } = useUserAuth();

    const [form, setForm] = useState({ name: "", email: "", mobile: "" });
    const [pass, setPass] = useState({ currentPassword: "", newPassword: "" });

    const [savingProfile, setSavingProfile] = useState(false);
    const [profileMsg, setProfileMsg] = useState({ type: "", text: "" });

    const [changingPass, setChangingPass] = useState(false);
    const [passMsg, setPassMsg] = useState({ type: "", text: "" });
    const [cooldownTime, setCooldownTime] = useState(0);

    useEffect(() => {
        if (user) {
            setForm({ name: user.name || "", email: user.email || "", mobile: user.mobile || "" });
            if (user.lastPasswordChange) {
                const elapsed = Date.now() - new Date(user.lastPasswordChange).getTime();
                const remain = (10 * 60 * 1000) - elapsed;
                if (remain > 0) setCooldownTime(remain);
            }
        }
    }, [user]);

    // Tick the cooldown timer every second
    useEffect(() => {
        if (cooldownTime <= 0) return;
        const it = setInterval(() => setCooldownTime(p => Math.max(0, p - 1000)), 1000);
        return () => clearInterval(it);
    }, [cooldownTime]);

    async function onSaveProfile(e) {
        e.preventDefault();
        setSavingProfile(true);
        setProfileMsg({ type: "", text: "" });
        try {
            await api.put("/api/users/profile", form);
            await qc.invalidateQueries({ queryKey: ["user-me"] });
            setProfileMsg({ type: "success", text: "Profile updated successfully." });
        } catch (err) {
            setProfileMsg({ type: "error", text: err?.response?.data?.message || "Failed to update profile." });
        } finally {
            setSavingProfile(false);
        }
    }

    async function onChangePassword(e) {
        e.preventDefault();
        setChangingPass(true);
        setPassMsg({ type: "", text: "" });
        try {
            await api.put("/api/users/password", pass);
            setPassMsg({ type: "success", text: "Password changed successfully." });
            setPass({ currentPassword: "", newPassword: "" });
            setCooldownTime(10 * 60 * 1000); // Start 10 min cooldown
            qc.invalidateQueries({ queryKey: ["user-me"] });
        } catch (err) {
            if (err?.response?.status === 429) {
                setCooldownTime(err.response.data.cooldownRemaining || 0);
            }
            setPassMsg({ type: "error", text: err?.response?.data?.message || "Failed to change password." });
        } finally {
            setChangingPass(false);
        }
    }

    const formatMs = (ms) => {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    };

    return (
        <div className="max-w-3xl space-y-6">
            <div>
                <h1 className="page-title flex items-center gap-2">My Profile</h1>
                <p className="page-subtitle">Manage your personal information and password.</p>
            </div>

            <div className="card p-4 sm:p-6">
                <h2 className="text-base font-semibold text-slate-900 border-b pb-3 mb-4 flex items-center gap-2">
                    <User size={18} className="text-[#1e3c72]" /> Personal details
                </h2>

                <form onSubmit={onSaveProfile} className="space-y-4 max-w-md w-full">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1"><User size={14} /> Full Name</label>
                        <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1"><Mail size={14} /> Email Address</label>
                        <input type="email" className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1"><Phone size={14} /> Mobile</label>
                        <input className="input" value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} required minLength={8} />
                    </div>

                    {profileMsg.text && (
                        <div className={`p-3 rounded-xl border text-sm flex flex-col gap-1 ${profileMsg.type === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}>
                            <div className="flex items-center gap-2">
                                {profileMsg.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                                {profileMsg.text}
                            </div>
                        </div>
                    )}

                    <div className="pt-2">
                        <button disabled={savingProfile} className="btn bg-[#1e3c72] hover:bg-[#1a3363] text-white">
                            {savingProfile ? "Saving..." : "Save Changes"}
                        </button>
                    </div>
                </form>
            </div>

            <div className="card p-4 sm:p-6">
                <div className="border-b pb-3 mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                        <Lock size={18} className="text-[#1e3c72]" /> Password & Security
                    </h2>
                    {cooldownTime > 0 && (
                        <span className="badge badge-inactive text-orange-600 bg-orange-50 border-orange-200 font-mono">
                            Cooldown: {formatMs(cooldownTime)}
                        </span>
                    )}
                </div>

                <form onSubmit={onChangePassword} className="space-y-4 max-w-md w-full">
                    {cooldownTime > 0 ? (
                        <div className="p-4 rounded-xl bg-orange-50 border border-orange-200 text-sm text-orange-800 flex gap-3">
                            <AlertCircle size={20} className="shrink-0 text-orange-600 mt-0.5" />
                            <div>
                                <strong>Action Locked</strong>
                                <p className="mt-1 opacity-90">For security, you can only change your password once every 10 minutes. Please wait {formatMs(cooldownTime)} before trying again.</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Current Password</label>
                                <input type="password" required className="input" value={pass.currentPassword} onChange={e => setPass({ ...pass, currentPassword: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                                <input type="password" required className="input" value={pass.newPassword} onChange={e => setPass({ ...pass, newPassword: e.target.value })} placeholder="Min 4 characters" />
                            </div>

                            {passMsg.text && (
                                <div className={`p-3 rounded-xl border text-sm flex flex-col gap-1 ${passMsg.type === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}>
                                    <div className="flex items-center gap-2">
                                        {passMsg.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                                        {passMsg.text}
                                    </div>
                                </div>
                            )}

                            <div className="pt-2">
                                <button disabled={changingPass} className="btn bg-[#1e3c72] hover:bg-[#1a3363] text-white">
                                    {changingPass ? "Changing..." : "Change Password"}
                                </button>
                            </div>
                        </>
                    )}
                </form>
            </div>
        </div>
    );
}
