import { Navigate, Outlet, Route, Routes } from "react-router";
import { MainLayout } from "../../components/layout/MainLayout";
import { Dashboard } from "../../features/analyses/pages/Dashboard";
import { AuthPage } from "../../features/auth/pages/AuthPage";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { NewAnalysis } from "../../features/analyses/pages/NewAnalysis";

import { Results } from "../../features/results/pages/Results";
import { History } from "../../features/analyses/pages/History";
import { Help } from "../../features/analyses/pages/Help";
import { Faq } from "../../features/analyses/pages/Faq";
import { Profile } from "../../features/profile/pages/Profile";
import { Users } from "../../features/users/pages/Users";
import { Roles } from "../../features/users/pages/Roles";
import { Images } from "../../features/images/pages/Images";
import { Models } from "../../features/models/pages/Models";
import { AdminModels } from "../../features/models/pages/AdminModels";
import { StudyAreas } from "../../features/study-areas/pages/StudyAreas";
import { AdminRoute } from "./AdminRoute";

function PrivateRoute() {
  const { checking, isAuthenticated } = useAuth();
  if (checking) return <p role="status">Comprobando sesión…</p>;
  return isAuthenticated ? (
    <MainLayout>
      <Outlet />
    </MainLayout>
  ) : (
    <Navigate to="/auth/login" replace />
  );
}
export const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/auth/login" element={<AuthPage />} />
      <Route path="/auth/register" element={<AuthPage registration />} />

      <Route element={<PrivateRoute />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route element={<AdminRoute permission="analyses.add_analysis" />}>
          <Route path="/dashboard/new" element={<NewAnalysis />} />
        </Route>
        <Route element={<AdminRoute permission="analyses.view_analysis" />}>
          <Route path="/dashboard/history" element={<History />} />
          <Route path="/dashboard/results/:id" element={<Results />} />
        </Route>
        <Route
          path="/dashboard/results"
          element={<Navigate to="/dashboard/history" replace />}
        />
        <Route path="/help" element={<Help />} />
        <Route path="/faq" element={<Faq />} />

        <Route
          element={<AdminRoute permission="catalog.view_satelliteimage" />}
        >
          <Route path="/images" element={<Images />} />
        </Route>
        <Route element={<AdminRoute permission="catalog.view_studyarea" />}>
          <Route path="/study-areas" element={<StudyAreas />} />
        </Route>
        <Route element={<AdminRoute permission="catalog.view_pipelinemodel" />}>
          <Route path="/models" element={<Models />} />
        </Route>
        <Route path="/profile" element={<Profile />} />

        <Route element={<AdminRoute permission="accounts.view_user" />}>
          <Route path="/admin/users" element={<Users />} />
        </Route>
        <Route element={<AdminRoute permission="auth.view_group" />}>
          <Route path="/admin/roles" element={<Roles />} />
        </Route>
        <Route element={<AdminRoute models />}>
          <Route path="/admin/models" element={<AdminModels />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};
