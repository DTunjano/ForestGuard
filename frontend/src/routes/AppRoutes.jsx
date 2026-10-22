import { Navigate, Outlet, Route, Routes } from "react-router";
import { Dashboard } from "../pages/dashboard/Dashboard";
import { AuthPage } from "../features/auth/pages/AuthPage";
import { useAuth } from "../features/auth/hooks/useAuth";
import { NewAnalysis } from "../pages/dashboard/NewAnalysis";

import { Results } from "../pages/dashboard/Results";
import { History } from "../pages/dashboard/History";
import { Help } from "../pages/dashboard/Help";
import { Profile } from "../pages/profile/Profile";
import { Users } from "../pages/admin/Users";
import { Models } from "../pages/admin/Models";
import { AdminRoute } from "./AdminRoute";

function PrivateRoute() {
  const { checking, isAuthenticated } = useAuth();
  if (checking) return <p role="status">Comprobando sesión…</p>;
  return isAuthenticated ? <Outlet /> : <Navigate to="/auth/login" replace />;
}
export const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/auth/login" element={<AuthPage />} />
      <Route path="/auth/register" element={<AuthPage registration />} />

      <Route element={<PrivateRoute />}>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/dashboard/new" element={<NewAnalysis />} />
      <Route path="/dashboard/history" element={<History />} />
      <Route path="/dashboard/results" element={<Results />} />
      <Route path="/help" element={<Help />} />

      <Route path="/profile" element={<Profile />} />

      <Route element={<AdminRoute />}>
        <Route path="/admin/users" element={<Users />} />
        <Route path="/admin/models" element={<Models />} />
      </Route>

      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};
