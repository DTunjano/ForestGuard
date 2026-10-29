import { Navigate, Outlet } from "react-router";
import { useAuth } from "../../features/auth/hooks/useAuth";

export const AdminRoute = ({ permission }) => {
  const { isAuthenticated, isAdmin, can } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  return (permission ? can(permission) : isAdmin) ? (
    <Outlet />
  ) : (
    <Navigate to="/dashboard" replace />
  );
};
