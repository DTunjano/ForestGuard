import { useMemo, useState } from "react";
import {
  LuCheck,
  LuPencil,
  LuPlus,
  LuSearch,
  LuTrash2,
  LuUserRound,
  LuUserRoundX,
  LuX,
} from "react-icons/lu";
import { MainLayout } from "../../components/layout/MainLayout";

const inputClass =
  "mt-2 h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-[#b9e75c]/70";

const initialUsers = [
  {
    user_id: 1,
    first_name: "Juan",
    last_name: "García López",
    email: "juan.garcia@forestguard.com",
    username: "juan.garcia",
    password: "",
    join_date: "2024-01-15",
    is_active: true,
    role: "Admin",
  },
  {
    user_id: 2,
    first_name: "María",
    last_name: "Rodríguez",
    email: "maria.rodriguez@forestguard.com",
    username: "maria.rodriguez",
    password: "",
    join_date: "2024-02-20",
    is_active: true,
    role: "Analista",
  },
  {
    user_id: 3,
    first_name: "Carlos",
    last_name: "Méndez",
    email: "carlos.mendez@forestguard.com",
    username: "carlos.mendez",
    password: "",
    join_date: "2024-03-12",
    is_active: false,
    role: "Analista",
  },
  {
    user_id: 4,
    first_name: "Laura",
    last_name: "Torres",
    email: "laura.torres@forestguard.com",
    username: "laura.torres",
    password: "",
    join_date: "2024-04-08",
    is_active: true,
    role: "Consulta",
  },
];

const emptyForm = {
  first_name: "",
  last_name: "",
  email: "",
  username: "",
  password: "",
  join_date: new Date().toISOString().slice(0, 10),
  is_active: true,
};

const roleStyles = {
  Admin: "bg-[#b9e75c]/10 text-[#b9e75c]",
  Analista: "bg-sky-300/10 text-sky-200",
  Consulta: "bg-white/[0.08] text-white/60",
};

export const Users = () => {
  const [users, setUsers] = useState(initialUsers);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("Todos");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({ ...emptyForm });

  const visibleUsers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return users.filter((user) => {
      const fullName = `${user.first_name} ${user.last_name}`.toLowerCase();
      const matchesSearch =
        !query ||
        fullName.includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.username.toLowerCase().includes(query);
      const matchesRole = roleFilter === "Todos" || user.role === roleFilter;
      const matchesStatus =
        statusFilter === "Todos" ||
        (statusFilter === "Activo" ? user.is_active : !user.is_active);
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [roleFilter, searchTerm, statusFilter, users]);

  const activeUsers = users.filter((user) => user.is_active).length;

  const openCreateForm = () => {
    setEditingUser(null);
    setFormData({ ...emptyForm });
    setIsFormOpen(true);
  };

  const openEditForm = (user) => {
    setEditingUser(user);
    setFormData({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      username: user.username,
      password: "",
      join_date: user.join_date,
      is_active: user.is_active,
    });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingUser(null);
    setFormData({ ...emptyForm });
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (editingUser) {
      setUsers((current) =>
        current.map((user) =>
          user.user_id === editingUser.user_id
            ? {
                ...user,
                ...formData,
                password: formData.password || user.password,
              }
            : user,
        ),
      );
    } else {
      setUsers((current) => [
        { ...formData, user_id: Date.now(), role: "Consulta" },
        ...current,
      ]);
    }
    closeForm();
  };

  const toggleStatus = (userId) => {
    setUsers((current) =>
      current.map((user) =>
        user.user_id === userId
          ? { ...user, is_active: !user.is_active }
          : user,
      ),
    );
  };

  const deleteUser = (userId) => {
    setUsers((current) => current.filter((user) => user.user_id !== userId));
  };

  return (
    <MainLayout>
      <div className="mx-auto max-w-400 space-y-7">
        <header className="flex flex-col justify-between gap-5 border-b border-white/10 pb-6 md:flex-row md:items-end">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#b9e75c]">
              Administración / usuarios
            </p>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
              Gestión de usuarios
            </h1>
            <p className="mt-2 text-sm text-white/45">
              Administra las cuentas y el acceso de las personas que utilizan
              ForestGuard.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateForm}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#b9e75c] px-4 text-sm font-bold text-[#10261d] transition hover:bg-[#d0f47d]"
          >
            <LuPlus size={17} />
            Nuevo usuario
          </button>
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          {[
            [String(users.length), "Usuarios registrados", LuUserRound],
            [String(activeUsers), "Cuentas activas", LuCheck],
            [
              String(users.length - activeUsers),
              "Cuentas inactivas",
              LuUserRoundX,
            ],
          ].map(([value, label, Icon]) => (
            <div
              key={label}
              className="flex items-center gap-4 rounded-2xl border border-white/10 bg-[#0b1728] p-4"
            >
              <div className="grid size-10 place-items-center rounded-xl bg-[#b9e75c]/10 text-[#b9e75c]">
                <Icon size={19} />
              </div>
              <div>
                <p className="text-2xl font-semibold text-white">{value}</p>
                <p className="mt-1 text-xs text-white/45">{label}</p>
              </div>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#0b1728] p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <LuSearch
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
                size={17}
              />
              <input
                type="search"
                placeholder="Buscar por nombre, username o correo"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className={`${inputClass} pl-11 pr-4`}
              />
            </div>
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              className={inputClass}
              aria-label="Filtrar por rol"
            >
              <option>Todos</option>
              <option>Admin</option>
              <option>Analista</option>
              <option>Consulta</option>
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className={inputClass}
              aria-label="Filtrar por estado"
            >
              <option>Todos</option>
              <option>Activo</option>
              <option>Inactivo</option>
            </select>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b1728]">
          <div className="hidden grid-cols-[minmax(220px,1.5fr)_minmax(120px,0.8fr)_minmax(100px,0.8fr)_minmax(120px,0.8fr)_minmax(100px,0.7fr)_auto] gap-4 border-b border-white/10 bg-white/[0.03] px-5 py-4 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/35 lg:grid">
            <span>Usuario</span>
            <span>Username</span>
            <span>Rol</span>
            <span>Fecha de alta</span>
            <span>Estado</span>
            <span>Acciones</span>
          </div>
          <div className="divide-y divide-white/10">
            {visibleUsers.length ? (
              visibleUsers.map((user) => (
                <article
                  key={user.user_id}
                  className="grid gap-4 px-5 py-5 transition hover:bg-white/[0.025] lg:grid-cols-[minmax(220px,1.5fr)_minmax(120px,0.8fr)_minmax(100px,0.8fr)_minmax(120px,0.8fr)_minmax(100px,0.7fr)_auto] lg:items-center"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#b9e75c]/10 text-[#b9e75c]">
                      <LuUserRound size={19} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">
                        {user.first_name} {user.last_name}
                      </p>
                      <p className="mt-1 truncate text-xs text-white/35">
                        {user.email}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm text-white/65">
                    @{user.username}
                  </span>
                  <span
                    className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-medium ${roleStyles[user.role] || roleStyles.Consulta}`}
                  >
                    {user.role || "Sin rol"}
                  </span>
                  <span className="text-sm text-white/65">
                    {user.join_date}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs ${user.is_active ? "text-[#b9e75c]" : "text-white/35"}`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${user.is_active ? "bg-[#b9e75c]" : "bg-white/25"}`}
                    />
                    {user.is_active ? "Activo" : "Inactivo"}
                  </span>
                  <div className="flex shrink-0 gap-1 lg:justify-end">
                    <button
                      type="button"
                      title="Editar usuario"
                      aria-label={`Editar ${user.first_name} ${user.last_name}`}
                      onClick={() => openEditForm(user)}
                      className="grid size-9 place-items-center rounded-lg text-white/35 transition hover:bg-white/[0.06] hover:text-[#b9e75c]"
                    >
                      <LuPencil size={16} />
                    </button>
                    <button
                      type="button"
                      title={
                        user.is_active
                          ? "Desactivar usuario"
                          : "Activar usuario"
                      }
                      aria-label={`${user.is_active ? "Desactivar" : "Activar"} ${user.first_name} ${user.last_name}`}
                      onClick={() => toggleStatus(user.user_id)}
                      className="grid size-9 place-items-center rounded-lg text-white/35 transition hover:bg-white/[0.06] hover:text-yellow-200"
                    >
                      {user.is_active ? (
                        <LuUserRoundX size={16} />
                      ) : (
                        <LuCheck size={16} />
                      )}
                    </button>
                    <button
                      type="button"
                      title="Eliminar usuario"
                      aria-label={`Eliminar ${user.first_name} ${user.last_name}`}
                      onClick={() => deleteUser(user.user_id)}
                      className="grid size-9 place-items-center rounded-lg text-white/35 transition hover:bg-red-400/10 hover:text-red-300"
                    >
                      <LuTrash2 size={16} />
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="px-5 py-12 text-center text-sm text-white/40">
                No hay usuarios que coincidan con los filtros.
              </div>
            )}
          </div>
        </section>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 z-60 grid place-items-center bg-[#020812]/80 p-5 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#0b1728] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b9e75c]">
                  Administración
                </p>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  {editingUser ? "Editar usuario" : "Nuevo usuario"}
                </h2>
                <p className="mt-2 text-sm text-white/45">
                  Los campos corresponden a la tabla de usuarios.
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                aria-label="Cerrar formulario"
                className="grid size-9 place-items-center rounded-lg text-white/40 transition hover:bg-white/[0.06] hover:text-white"
              >
                <LuX size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  ["first_name", "Primer nombre", "Juan"],
                  ["last_name", "Apellidos", "García López"],
                ].map(([name, label, placeholder]) => (
                  <label key={name} className="block text-sm text-white/65">
                    {label}
                    <input
                      required
                      name={name}
                      value={formData[name]}
                      onChange={handleFormChange}
                      placeholder={placeholder}
                      className={inputClass}
                    />
                  </label>
                ))}
              </div>
              {[
                [
                  "email",
                  "Correo electrónico",
                  "email",
                  "correo@forestguard.com",
                ],
                ["username", "Nombre de usuario", "text", "juan.garcia"],
                ["password", "Contraseña", "password", "Contraseña segura"],
                ["join_date", "Fecha de alta", "date", ""],
              ].map(([name, label, type, placeholder]) => (
                <label key={name} className="block text-sm text-white/65">
                  {label}
                  <input
                    required={name !== "password" || !editingUser}
                    name={name}
                    type={type}
                    value={formData[name]}
                    onChange={handleFormChange}
                    placeholder={placeholder}
                    className={inputClass}
                  />
                </label>
              ))}
              <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white/65">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      is_active: event.target.checked,
                    }))
                  }
                  className="size-4 accent-[#b9e75c]"
                />
                Cuenta activa
              </label>
              <div className="flex justify-end gap-2 border-t border-white/10 pt-5">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/60 transition hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#b9e75c] px-4 py-2.5 text-sm font-bold text-[#10261d] transition hover:bg-[#d0f47d]"
                >
                  {editingUser ? "Guardar cambios" : "Crear usuario"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
};
