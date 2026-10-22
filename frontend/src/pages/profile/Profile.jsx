import { useState } from "react";
import { useNavigate } from "react-router";
import {
  LuArrowLeft,
  LuBadgeCheck,
  LuCalendarDays,
  LuCheck,
  LuMail,
  LuPencil,
  LuShieldCheck,
  LuX,
} from "react-icons/lu";
import { toast } from "sonner";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { MainLayout } from "../../components/layout/MainLayout";

const fieldClass =
  "mt-2 h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none transition focus:border-[#b9e75c]/70";

export const Profile = () => {
  const navigate = useNavigate();
  const { user, updateProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    email: user?.email || "",
    username: user?.username || "",
    password: "",
  });
  const [isSecurityOpen, setIsSecurityOpen] = useState(false);
  const [securityData, setSecurityData] = useState({
    username: user?.username || "",
    password: "",
  });

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSave = (event) => {
    event.preventDefault();
    updateProfile({
      ...formData,
      name: `${formData.first_name} ${formData.last_name}`.trim(),
      ...(formData.password ? {} : { password: user?.password || "" }),
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setFormData({
      first_name: user?.first_name || "",
      last_name: user?.last_name || "",
      email: user?.email || "",
      username: user?.username || "",
      password: "",
    });
    setIsEditing(false);
  };

  const passwordChecks = {
    minLength: securityData.password.length >= 8,
    uppercase: /[A-Z]/.test(securityData.password),
    lowercase: /[a-z]/.test(securityData.password),
    number: /\d/.test(securityData.password),
    special: /[^A-Za-z0-9]/.test(securityData.password),
  };
  const passwordScore = Object.values(passwordChecks).filter(Boolean).length;
  const passwordStrength =
    passwordScore === 0
      ? "Sin evaluar"
      : passwordScore <= 2
        ? "Débil"
        : passwordScore <= 4
          ? "Media"
          : "Fuerte";
  const passwordStrengthColor =
    passwordScore <= 2
      ? "bg-red-400"
      : passwordScore <= 4
        ? "bg-amber-300"
        : "bg-[#b9e75c]";

  const openSecurityModal = () => {
    setSecurityData({ username: user?.username || "", password: "" });
    setIsSecurityOpen(true);
  };

  const closeSecurityModal = () => {
    setIsSecurityOpen(false);
    setSecurityData({ username: user?.username || "", password: "" });
  };

  const handleSecurityChange = (event) => {
    const { name, value } = event.target;
    setSecurityData((current) => ({ ...current, [name]: value }));
  };

  const handleSecuritySave = (event) => {
    event.preventDefault();

    if (!securityData.username.trim() || passwordScore < 5) {
      toast.warning("Completa todos los requisitos de seguridad.");
      return;
    }

    updateProfile(securityData);
    toast.success("Usuario y contraseña actualizados.");
    closeSecurityModal();
  };

  const joinDate = user?.joinDate
    ? new Date(user.joinDate).toLocaleDateString("es-ES", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "No disponible";

  return (
    <MainLayout>
      <div className="mx-auto max-w-6xl space-y-7">
        <header className="flex flex-col justify-between gap-5 border-b border-white/10 pb-7 sm:flex-row sm:items-end">
          <div>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mb-6 flex items-center gap-2 text-xs font-medium text-white/40 transition hover:text-[#b9e75c]"
            >
              <LuArrowLeft size={15} />
              Volver
            </button>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b9e75c]">
              Cuenta / identidad
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
              Perfil de usuario
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/45">
              Mantén actualizada la información que identifica tu trabajo en
              ForestGuard.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#b9e75c] px-4 py-2.5 text-sm font-bold text-[#10261d] transition hover:bg-[#d0f47d]"
          >
            <LuPencil size={16} />
            Editar perfil
          </button>
        </header>

        <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0b1728]">
          <div className="relative h-36 overflow-hidden bg-[linear-gradient(110deg,rgba(185,231,92,0.22),rgba(7,19,28,0.2),rgba(14,55,45,0.8))]">
            <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:36px_36px]" />
          </div>
          <div className="relative flex flex-col gap-5 px-6 pb-7 sm:flex-row sm:items-end sm:justify-between sm:px-8">
            <div className="-mt-14 flex items-end gap-5">
              <div className="grid size-28 shrink-0 place-items-center rounded-3xl border-4 border-[#0b1728] bg-linear-to-br from-[#b9e75c] to-emerald-600 text-5xl font-bold text-[#10261d] shadow-xl">
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt="Avatar"
                    className="size-full rounded-xl object-cover"
                  />
                ) : (
                  user?.name?.charAt(0).toUpperCase()
                )}
              </div>
              <div className="pb-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-semibold tracking-tight text-white">
                    {user?.name}
                  </h2>
                  <LuBadgeCheck className="text-[#b9e75c]" size={17} />
                </div>
                <p className="mt-1 text-sm text-[#b9e75c]">@{user?.username}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 pb-2 text-xs text-white/45">
              <span className="flex items-center gap-2 rounded-full border border-[#b9e75c]/20 bg-[#b9e75c]/10 px-3 py-1.5 text-[#b9e75c]">
                <span className="size-1.5 rounded-full bg-[#b9e75c]" />
                Cuenta activa
              </span>
              <span className="hidden text-white/30 sm:inline">{user?.role}</span>
            </div>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
          <section className="rounded-2xl border border-white/10 bg-[#0b1728] p-6 sm:p-7">
            <div className="flex items-end justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b9e75c]">
                  Información personal
                </p>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  Datos de tu cuenta
                </h2>
              </div>
              <LuBadgeCheck className="text-[#b9e75c]/70" size={22} />
            </div>
            <dl className="divide-y divide-white/10">
              <div className="grid gap-2 py-4 sm:grid-cols-[0.8fr_1.2fr]">
                <dt className="text-sm text-white/40">Nombre completo</dt>
                <dd className="text-sm font-medium text-white sm:text-right">{user?.name}</dd>
              </div>
              <div className="grid gap-2 py-4 sm:grid-cols-[0.8fr_1.2fr]">
                <dt className="text-sm text-white/40">Correo electrónico</dt>
                <dd className="flex items-center gap-2 text-sm font-medium text-white sm:justify-end"><LuMail size={14} className="text-[#b9e75c]" />{user?.email}</dd>
              </div>
              <div className="grid gap-2 py-4 sm:grid-cols-[0.8fr_1.2fr]">
                <dt className="text-sm text-white/40">Nombre de usuario</dt>
                <dd className="text-sm font-medium text-white sm:text-right">@{user?.username}</dd>
              </div>
              <div className="grid gap-2 pt-4 sm:grid-cols-[0.8fr_1.2fr]">
                <dt className="text-sm text-white/40">Rol o cargo</dt>
                <dd className="text-sm font-medium text-[#b9e75c] sm:text-right">{user?.role}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#0b1728] p-6 sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b9e75c]">
              Cuenta
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              Tu espacio ForestGuard
            </h2>
            <div className="mt-6 space-y-5">
              <div className="flex items-start gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#b9e75c]/10 text-[#b9e75c]"><LuCalendarDays size={18} /></div>
                <div><p className="text-xs text-white/35">Miembro desde</p><p className="mt-1 text-sm font-medium text-white">{joinDate}</p></div>
              </div>
              <div className="flex items-start gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#b9e75c]/10 text-[#b9e75c]"><LuShieldCheck size={18} /></div>
                <div><p className="text-xs text-white/35">Nivel de acceso</p><p className="mt-1 text-sm font-medium text-white">{user?.role || "Usuario"}</p></div>
              </div>
            </div>
            <div className="mt-7 border-t border-white/10 pt-5">
              <p className="text-xs leading-5 text-white/40">Tu perfil identifica quién realiza cada análisis y mantiene la trazabilidad de los resultados.</p>
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-red-400/15 bg-red-400/[0.04] p-5">
          <h2 className="text-sm font-semibold text-red-300">
            Seguridad de la cuenta
          </h2>
          <p className="mt-2 text-sm text-white/40">
            Protege tus credenciales y mantén actualizado tu acceso.
          </p>
          <button
            type="button"
            onClick={openSecurityModal}
            className="mt-4 rounded-xl border border-red-300/20 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-300/10"
          >
            Cambiar Usuario o Contraseña
          </button>
        </section>
      </div>

      {isEditing && (
        <div
          className="fixed inset-0 z-60 grid place-items-center bg-[#020812]/80 p-5 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-profile-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) handleCancel();
          }}
        >
          <form
            onSubmit={handleSave}
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0b1728] p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b9e75c]">
                  Cuenta / perfil
                </p>
                <h2
                  id="edit-profile-title"
                  className="mt-2 text-xl font-semibold text-white"
                >
                  Editar información
                </h2>
                <p className="mt-2 text-sm text-white/45">
                  Actualiza los datos que identifican tu cuenta.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCancel}
                aria-label="Cerrar edición de perfil"
                className="grid size-9 place-items-center rounded-lg text-white/40 transition hover:bg-white/[0.06] hover:text-white"
              >
                <LuX size={18} />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm text-white/65">
                  Primer nombre
                  <input
                    required
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleInputChange}
                    className={fieldClass}
                  />
                </label>
                <label className="block text-sm text-white/65">
                  Apellidos
                  <input
                    required
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleInputChange}
                    className={fieldClass}
                  />
                </label>
              </div>

              <label className="block text-sm text-white/65">
                Correo electrónico
                <input
                  required
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={fieldClass}
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-white/10 pt-5">
              <button
                type="button"
                onClick={handleCancel}
                className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/60 transition hover:text-white"
              >
                <LuX size={16} />
                Cancelar
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 rounded-xl bg-[#b9e75c] px-4 py-2.5 text-sm font-bold text-[#10261d] transition hover:bg-[#d0f47d]"
              >
                <LuCheck size={16} />
                Guardar cambios
              </button>
            </div>
          </form>
        </div>
      )}

      {isSecurityOpen && (
        <div
          className="fixed inset-0 z-60 grid place-items-center bg-[#020812]/80 p-5 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="security-modal-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeSecurityModal();
          }}
        >
          <form
            onSubmit={handleSecuritySave}
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0b1728] p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-300">
                  Seguridad de la cuenta
                </p>
                <h2
                  id="security-modal-title"
                  className="mt-2 text-xl font-semibold text-white"
                >
                  Cambiar usuario y contraseña
                </h2>
                <p className="mt-2 text-sm leading-6 text-white/45">
                  Usa una contraseña única para proteger tu cuenta.
                </p>
              </div>
              <button
                type="button"
                onClick={closeSecurityModal}
                aria-label="Cerrar modal de seguridad"
                className="grid size-9 place-items-center rounded-lg text-white/40 transition hover:bg-white/[0.06] hover:text-white"
              >
                <LuX size={18} />
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <label className="block text-sm text-white/65">
                Nombre de usuario
                <input
                  required
                  name="username"
                  value={securityData.username}
                  onChange={handleSecurityChange}
                  className={fieldClass}
                />
              </label>

              <div>
                <label className="block text-sm text-white/65">
                  Nueva contraseña
                  <input
                    required
                    type="password"
                    name="password"
                    value={securityData.password}
                    onChange={handleSecurityChange}
                    className={fieldClass}
                  />
                </label>

                <div className="mt-4 space-y-3" aria-live="polite">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/40">Seguridad de la contraseña</span>
                    <span
                      className={
                        passwordScore === 5
                          ? "font-semibold text-[#b9e75c]"
                          : "text-white/55"
                      }
                    >
                      {passwordStrength}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full transition-all duration-300 ${passwordStrengthColor}`}
                      style={{ width: `${passwordScore * 20}%` }}
                    />
                  </div>
                  <ul className="grid gap-2 text-xs sm:grid-cols-2">
                    {[
                      [passwordChecks.minLength, "Mínimo 8 caracteres"],
                      [passwordChecks.uppercase, "Una letra mayúscula"],
                      [passwordChecks.lowercase, "Una letra minúscula"],
                      [passwordChecks.number, "Un número"],
                      [passwordChecks.special, "Un carácter especial"],
                    ].map(([isValid, label]) => (
                      <li
                        key={label}
                        className={`flex items-center gap-2 ${isValid ? "text-[#b9e75c]" : "text-white/40"}`}
                      >
                        <span
                          className={`grid size-4 place-items-center rounded-full ${isValid ? "bg-[#b9e75c]/15" : "bg-white/[0.06]"}`}
                        >
                          {isValid ? <LuCheck size={11} /> : <LuX size={10} />}
                        </span>
                        {label}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-white/10 pt-5">
              <button
                type="button"
                onClick={closeSecurityModal}
                className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/60 transition hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={passwordScore < 5 || !securityData.username.trim()}
                className="rounded-xl bg-[#b9e75c] px-4 py-2.5 text-sm font-bold text-[#10261d] transition hover:bg-[#d0f47d] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Guardar cambios
              </button>
            </div>
          </form>
        </div>
      )}
    </MainLayout>
  );
};
