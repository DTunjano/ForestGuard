import { Route, Routes } from "react-router";
import { Dashboard } from "../pages/dashboard/Dashboard";
import { Login } from "../pages/auth/Login";
import { NewAnalysis } from "../pages/dashboard/NewAnalysis";
import { Register } from "../pages/auth/Register";
import { Results } from "../pages/dashboard/Results";
import { History } from "../pages/dashboard/History";
import { Help } from "../pages/dashboard/Help";
import { Profile } from "../pages/profile/Profile";
import { Users } from "../pages/admin/Users";
import { Models } from "../pages/admin/Models";
import { AdminRoute } from "./AdminRoute";

export const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/auth/login" element={<Login />} />
      <Route path="/auth/register" element={<Register />} />

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

      {/* <Route path="*" element={<NotFound />} /> */}
    </Routes>
  );
};
