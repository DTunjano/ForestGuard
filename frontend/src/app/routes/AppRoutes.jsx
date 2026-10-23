import { Navigate, Outlet, Route, Routes } from "react-router";
import { Dashboard } from "../../features/analyses/pages/Dashboard";
import { AuthPage } from "../../features/auth/pages/AuthPage";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { NewAnalysis } from "../../features/analyses/pages/NewAnalysis";

import { Results } from "../../features/results/pages/Results";
import { History } from "../../features/analyses/pages/History";
import { Help } from "../../features/analyses/pages/Help";
import { Profile } from "../../features/profile/pages/Profile";
import { Users } from "../../features/users/pages/Users";
import { Images } from "../../features/images/pages/Images";
import { Models } from "../../features/models/pages/Models";
import { StudyAreas } from "../../features/study-areas/pages/StudyAreas";
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
        <Route
          path="/dashboard/results"
          element={<Navigate to="/dashboard/history" replace />}
        />
        <Route path="/dashboard/results/:id" element={<Results />} />
        <Route path="/help" element={<Help />} />

        <Route path="/images" element={<Images />} />
        <Route path="/study-areas" element={<StudyAreas />} />
        <Route path="/models" element={<Models />} />
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
