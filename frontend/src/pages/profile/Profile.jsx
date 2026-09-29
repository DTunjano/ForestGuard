import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { PiArrowLeft, PiBuilding, PiCalendarBold, PiCheckBold, PiEnvelopeSimpleBold, PiPencil, PiXBold } from "react-icons/pi";

export const Profile = () => {
  const navigate = useNavigate();
  const { user, updateProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || "",
    role: user?.role || "",
    email: user?.email || "",
    department: user?.department || "",
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSave = () => {
    updateProfile(formData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setFormData({
      name: user?.name || "",
      role: user?.role || "",
      email: user?.email || "",
      department: user?.department || "",
    });
    setIsEditing(false);
  };

  return (
    <div className="min-h-screen bg-[#0b1728]">
      {/* HEADER */}
      <header className="h-16 border-b border-[#1e293b] bg-[#0b1728] flex items-center px-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-400 hover:text-green-400 transition"
        >
          <PiArrowLeft className="text-2xl" />
          <span className="text-sm">Volver</span>
        </button>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="max-w-2xl mx-auto px-6 py-12">
        {/* CARD DE PERFIL */}
        <div className="bg-gradient-to-br from-[#0f1f32] to-[#0b1728] border border-[#1e293b] rounded-2xl overflow-hidden shadow-xl">
          {/* BANNER SUPERIOR CON GRADIENTE */}
          <div className="h-32 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-b border-[#1e293b] flex items-center px-8 relative overflow-hidden">
            <div className="absolute inset-0 opacity-30">
              <div className="absolute top-0 right-0 w-40 h-40 bg-green-500/10 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl"></div>
            </div>
          </div>

          {/* CONTENIDO DEL PERFIL */}
          <div className="px-8 py-8 relative z-10">
            {/* AVATAR Y INFO BÁSICA */}
            <div className="flex items-start justify-between mb-8">
              <div className="flex items-center gap-6">
                {/* AVATAR GRANDE */}
                <div className="w-24 h-24 -mt-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center border-4 border-[#0b1728] shadow-lg">
                  {user?.avatar ? (
                    <img
                      src={user.avatar}
                      alt="Avatar"
                      className="w-full h-full rounded-2xl object-cover"
                    />
                  ) : (
                    <span className="text-5xl font-bold text-white">
                      {user?.name?.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                {/* INFO BÁSICA */}
                <div>
                  {isEditing ? (
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="text-2xl font-bold text-green-400 bg-[#1e293b] border border-green-400/30 rounded-lg px-3 py-1 mb-2 w-full focus:outline-none focus:border-green-400"
                    />
                  ) : (
                    <h1 className="text-2xl font-bold text-green-400 mb-1">
                      {user?.name}
                    </h1>
                  )}

                  {isEditing ? (
                    <input
                      type="text"
                      name="role"
                      value={formData.role}
                      onChange={handleInputChange}
                      className="text-sm text-emerald-300 bg-[#1e293b] border border-green-400/30 rounded-lg px-3 py-1 w-full focus:outline-none focus:border-green-400"
                    />
                  ) : (
                    <p className="text-sm text-emerald-300">{user?.role}</p>
                  )}
                </div>
              </div>

              {/* BOTONES DE ACCIÓN */}
              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={handleSave}
                      className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-all duration-200 font-semibold"
                    >
                      <PiCheckBold className="text-lg" />
                      Guardar
                    </button>
                    <button
                      onClick={handleCancel}
                      className="flex items-center gap-2 px-4 py-2 bg-[#1e293b] hover:bg-[#2d3e4f] text-gray-300 rounded-lg transition-all duration-200"
                    >
                      <PiXBold className="text-lg" />
                      Cancelar
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-400/30 rounded-lg transition-all duration-200 font-semibold"
                  >
                    <PiPencil className="text-lg" />
                    Editar
                  </button>
                )}
              </div>
            </div>

            {/* DIVIDER */}
            <div className="h-px bg-gradient-to-r from-[#1e293b] via-green-500/20 to-[#1e293b] mb-8"></div>

            {/* INFORMACIÓN DETALLADA */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* EMAIL */}
              <div className="bg-[#0b1728]/50 border border-[#1e293b] rounded-xl p-4 hover:border-green-400/20 transition">
                <div className="flex items-center gap-3 mb-2">
                  <PiEnvelopeSimpleBold className="text-xl text-green-400" />
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    Correo Electrónico
                  </p>
                </div>
                {isEditing ? (
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="text-sm text-white bg-[#1e293b] border border-green-400/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:border-green-400"
                  />
                ) : (
                  <p className="text-white font-medium">{user?.email}</p>
                )}
              </div>

              {/* ROL */}
              <div className="bg-[#0b1728]/50 border border-[#1e293b] rounded-xl p-4 hover:border-green-400/20 transition">
                <div className="flex items-center gap-3 mb-2">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    Rol/Cargo
                  </p>
                </div>
                <p className="text-white font-medium">{user?.role}</p>
              </div>

              {/* DEPARTAMENTO */}
              <div className="bg-[#0b1728]/50 border border-[#1e293b] rounded-xl p-4 hover:border-green-400/20 transition">
                <div className="flex items-center gap-3 mb-2">
                  <PiBuilding className="text-xl text-green-400" />
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    Departamento
                  </p>
                </div>
                {isEditing ? (
                  <input
                    type="text"
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                    className="text-sm text-white bg-[#1e293b] border border-green-400/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:border-green-400"
                  />
                ) : (
                  <p className="text-white font-medium">{user?.department}</p>
                )}
              </div>

              {/* FECHA DE UNIÓN */}
              <div className="bg-[#0b1728]/50 border border-[#1e293b] rounded-xl p-4 hover:border-green-400/20 transition">
                <div className="flex items-center gap-3 mb-2">
                  <PiCalendarBold className="text-xl text-green-400" />
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    Miembro desde
                  </p>
                </div>
                <p className="text-white font-medium">
                  {new Date(user?.joinDate).toLocaleDateString("es-ES", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>

            {/* DIVIDER */}
            <div className="h-px bg-gradient-to-r from-[#1e293b] via-green-500/20 to-[#1e293b] my-8"></div>

            {/* SECCIÓN DE SEGURIDAD */}
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-red-400 mb-4 uppercase tracking-wide">
                Zona de Peligro
              </h3>
              <p className="text-sm text-gray-400 mb-4">
                Acciones que podrían afectar tu cuenta.
              </p>
              <button className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg transition-all duration-200 font-medium text-sm">
                Cambiar Contraseña
              </button>
            </div>
          </div>
        </div>

        {/* FOOTER INFO */}
        <div className="mt-8 text-center text-xs text-gray-500">
          <p>ForestGuard © 2024 • Todos los derechos reservados</p>
        </div>
      </main>
    </div>
  );
};
