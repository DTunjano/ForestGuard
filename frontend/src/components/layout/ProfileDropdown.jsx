import { useRef, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { PiSignOutBold, PiUserBold } from "react-icons/pi";
import { useAuth } from "../../features/auth/hooks/useAuth";

export const ProfileDropdown = ({
  sidebar = false,
  expanded = false,
  onActivate,
}) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Cerrar dropdown cuando se hace clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleProfileClick = () => {
    setIsOpen(false);
    navigate("/profile");
  };

  const handleLogout = async () => {
    try { await logout(); } catch { /* Local session is already cleared. */ }
    navigate("/auth/login");
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* BOTÓN DE PERFIL */}
      <button
        type="button"
        onClick={() => {
          onActivate?.();
          setIsOpen((current) => !current);
        }}
        aria-label="Abrir perfil"
        aria-expanded={isOpen}
        className={`flex h-12 w-full items-center gap-3 rounded-xl px-2 py-2 transition-all duration-200 hover:bg-white/6 ${sidebar ? "overflow-hidden" : ""}`}
      >
        {/* Avatar */}
        <div
          className={`flex ${sidebar ? "size-9" : "size-10"} shrink-0 items-center justify-center rounded-full bg-linear-to-br from-green-500 to-green-600 border border-green-400/30 transition hover:border-green-400/60`}
        >
          {user?.avatar ? (
            <img
              src={user.avatar}
              alt="Avatar"
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <span className="text-sm font-bold text-white">
              {(user?.first_name || user?.username)?.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {/* Info Usuario */}
        <div
          className={`${sidebar ? (expanded ? "flex" : "hidden") : "hidden sm:flex"} min-w-0 flex-col items-start leading-tight`}
        >
          <p className="max-w-32 truncate text-sm font-semibold text-white">
            {(user?.first_name || user?.username)}
          </p>
          <p className="max-w-32 truncate text-[11px] text-gray-400">
            {user?.role === 'admin' ? 'Administrador' : 'Analista'}
          </p>
        </div>
      </button>

      {/* DROPDOWN MENU */}
      {isOpen && (!sidebar || expanded) && (
        <div
          className={`absolute ${sidebar ? "bottom-0 left-full ml-3" : "right-0 top-full mt-2"} z-50 w-56 overflow-hidden rounded-lg border border-[#1e293b] bg-[#0b1728] shadow-2xl animate-fadeIn`}
        >
          {/* HEADER CON INFO DEL USUARIO */}
          <div className="border-b border-[#1e293b] bg-linear-to-r from-[#0b1728] to-[#0f1f32] px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-full bg-linear-to-br from-green-500 to-green-600 border border-green-400/30">
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt="Avatar"
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-lg font-bold text-white">
                    {(user?.first_name || user?.username)?.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{(user?.first_name || user?.username)}</p>
                <p className="text-xs text-green-400/80">{user?.role === 'admin' ? 'Administrador' : 'Analista'}</p>
              </div>
            </div>
          </div>

          {/* OPCIONES */}
          <div className="py-2">
            {/* Opción: Ver Perfil */}
            <button
              onClick={handleProfileClick}
              className="w-full px-4 py-3 flex items-center gap-3 text-gray-300 hover:bg-[#1e293b] hover:text-green-400 transition-all duration-150 group"
            >
              <PiUserBold className="text-lg group-hover:text-green-400 transition" />
              <span className="text-sm">Ver Perfil</span>
            </button>

            {/* Divider */}
            <div className="mx-2 h-px bg-[#1e293b]"></div>

            {/* Opción: Cerrar Sesión */}
            <button
              onClick={handleLogout}
              className="w-full px-4 py-3 flex items-center gap-3 text-gray-300 hover:bg-red-500/10 hover:text-red-400 transition-all duration-150 group"
            >
              <PiSignOutBold className="text-lg group-hover:text-red-400 transition" />
              <span className="text-sm">Cerrar Sesión</span>
            </button>
          </div>
        </div>
      )}

      {/* ESTILOS PARA ANIMACIÓN */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
};
