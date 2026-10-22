import { useEffect, useState } from "react";
import { AuthContext } from "../../features/auth/hooks/useAuth";
import { getMe, editProfile } from "../../features/auth/api/auth";
import {
  login,
  logout,
  onSessionExpired,
  refreshSession,
} from "../../shared/api/client";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    let active = true;
    const unsubscribe = onSessionExpired(() => setUser(null));
    refreshSession()
      .then((ok) => (ok ? getMe() : null))
      .then((data) => {
        if (active) setUser(data);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  async function signIn(credentials) {
    await login(credentials);
    setUser(await getMe());
  }
  async function updateProfile(data) {
    setUser(await editProfile(data));
  }
  return (
    <AuthContext.Provider
      value={{
        user,
        checking,
        isAuthenticated: !!user,
        isAdmin: user?.role === "admin",
        signIn,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
