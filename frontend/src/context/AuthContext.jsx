import { createContext, useContext, useState } from "react";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState({
    id: 1,
    name: "Juan García López",
    email: "juan.garcia@forestguard.com",
    role: "Analista Senior",
    avatar: null, // URL de la foto de perfil
    department: "Análisis Satelital",
    joinDate: "2024-01-15",
  });

  const [isAuthenticated, setIsAuthenticated] = useState(true);

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
