import { Navigate, Outlet } from "react-router";
import { useAuth } from "../../features/auth/hooks/useAuth";

export const AdminRoute = ({ permission, models }) => {
  const { isAuthenticated, isAdmin, can, canManageModels } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  return (models ? canManageModels : permission ? can(permission) : isAdmin) ? (
    <Outlet />
  ) : (
    <Navigate to="/dashboard" replace />
  );
};
