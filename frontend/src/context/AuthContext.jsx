import { createContext, useContext, useState } from "react";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState({
    user_id: 1,
    first_name: "Juan",
    last_name: "García López",
    name: "Juan García López",
    email: "juan.garcia@forestguard.com",
    username: "juan.garcia",
    password: "",
    role: "Admin",
    avatar: null, // URL de la foto de perfil
    department: "Análisis Satelital",
    join_date: "2024-01-15",
    joinDate: "2024-01-15",
    is_active: true,
  });

  const [isAuthenticated, setIsAuthenticated] = useState(true);

  const isAdmin = user?.role === "Admin";

  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
    // Aquí iría la lógica de logout con el backend
  };

  const updateProfile = (updatedData) => {
    setUser({ ...user, ...updatedData });
    // Aquí iría la llamada al backend
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isAdmin,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe ser usado dentro de AuthProvider");
  }
  return context;
};
