import { Routes, Route, Navigate } from "react-router-dom";
import PublicHome from "./pages/PublicHome";

import AdminLayout from "./pages/admin/AdminLayout";
import AdminLogin from "./pages/admin/AdminLogin";

import AdminDashboardHome from "./pages/admin/routes/AdminDashboardHome";
import AdminItems from "./pages/admin/routes/AdminItems";
import AdminCollections from "./pages/admin/routes/AdminCollections";
import AdminProfile from "./pages/admin/routes/AdminProfile";
import AdminActivity from "./pages/admin/routes/AdminActivity";
import AdminExport from "./pages/admin/routes/AdminExport";
import AdminMills from "./pages/admin/routes/AdminMills";
import AdminQuantities from "./pages/admin/routes/AdminQuantities";
import AdminDesignNos from "./pages/admin/routes/AdminDesignNos";

import UserLayout from "./pages/user/UserLayout";
import UserLogin from "./pages/user/UserLogin";
import UserProfile from "./pages/user/UserProfile";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicHome />} />

      <Route path="/admin" element={<AdminLayout />}>
        <Route path="login" element={<AdminLogin />} />
        <Route index element={<AdminDashboardHome />} />
        <Route path="items" element={<AdminItems />} />
        <Route path="collections" element={<AdminCollections />} />
        <Route path="profile" element={<AdminProfile />} />
        <Route path="activity" element={<AdminActivity />} />
        <Route path="export" element={<AdminExport />} />
        <Route path="mills" element={<AdminMills />} />
        <Route path="quantities" element={<AdminQuantities />} />
        <Route path="design-nos" element={<AdminDesignNos />} />
      </Route>

      <Route path="/user" element={<UserLayout />}>
        <Route path="login" element={<UserLogin />} />
        <Route index element={<UserProfile />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}