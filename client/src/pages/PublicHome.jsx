import { Link } from "react-router-dom";
import { Shield, ArrowRight } from "lucide-react";

export default function PublicHome() {
  return (
    <div className="auth-page">
      <div className="w-full max-w-3xl card p-5 sm:p-8 md:p-10 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5 text-white"
          style={{ background: "linear-gradient(135deg, #1f4b99 0%, #2f6ad8 100%)" }}
        >
          <Shield size={28} />
        </div>

        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900">S Management</h1>
        <p className="mt-3 text-sm sm:text-base text-slate-600 max-w-xl mx-auto">
          Unified management platform for items, collections, mills, quantities, and design numbers.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
          <Link to="/admin" className="btn btn-primary w-full sm:w-auto px-6 py-3">
            Open Admin Panel
            <ArrowRight size={16} />
          </Link>

          <Link to="/user/login" className="btn btn-ghost w-full sm:w-auto px-6 py-3">
            Open User Portal
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}
