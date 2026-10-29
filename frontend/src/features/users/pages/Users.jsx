import {
  LuArrowDownAZ,
  LuArrowDownWideNarrow,
  LuArrowLeft,
  LuArrowRight,
  LuArrowUpNarrowWide,
  LuCalendarDays,
  LuCheck,
  LuChevronDown,
  LuCircleAlert,
  LuEye,
  LuEyeOff,
  LuFilter,
  LuPencil,
  LuPlus,
  LuRotateCcw,
  LuSearch,
  LuShieldAlert,
  LuShieldCheck,
  LuUserCheck,
  LuUserPlus,
  LuUserRound,
  LuX,
} from "react-icons/lu";
import { Modal } from "../../../shared/components/Modal";
import { useAuth } from "../../auth/hooks/useAuth";
import { useEffect, useRef, useState } from "react";
import { useResource } from "../../../shared/api/useResource";
import { saveUser } from "../api/users";
import { AdministratorForm } from "../components/AdministratorForm";
import {
  Page,
  Panel,
  Field,
  Button,
  Notice,
  Select,
  EmptyState,
} from "../../../shared/components/UI";

const PAGE_LIMIT = 10;

const FILTER_CRITERIA = [
  { key: "search", label: "Búsqueda" },
  { key: "role", label: "Rol" },
  { key: "status", label: "Estado" },
];

const roleLabel = (role) =>
  role.name === "admin"
    ? "Administrador"
    : role.name === "analyst"
      ? "Analista"
      : role.name;
const isAdministrator = (user) =>
  user.is_superuser || user.roles?.some((role) => role.name === "admin");
const roleNames = (user) =>
  user.is_superuser
    ? "Superusuario"
    : user.roles?.map(roleLabel).join(", ") || "Sin roles asignados";

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "true", label: "Activo" },
  { value: "false", label: "Inactivo" },
];

function getInitials(user) {
  const full = `${user.first_name || ""} ${user.last_name || ""}`.trim();
  if (full) {
    return full
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("");
  }
  return (user.username || "U").slice(0, 2).toUpperCase();
}

function formatJoinDate(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function validateUsername(val) {
  if (!val || val.trim() === "") {
    return { valid: false, message: "El nombre de usuario es obligatorio." };
  }
  const trimmed = val.trim();
  if (trimmed.length < 3) {
    return { valid: false, message: "Mínimo 3 caracteres requeridos." };
  }
  if (trimmed.length > 150) {
    return { valid: false, message: "No puede exceder los 150 caracteres." };
  }
  if (!/^[\w.@+-]+$/.test(trimmed)) {
    return {
      valid: false,
      message: "Solo se permiten letras, números y los símbolos @/./+/-/_",
    };
  }
  return { valid: true, message: "Formato de nombre de usuario válido." };
}

function validateEmail(val) {
  if (!val || val.trim() === "") {
    return { valid: false, message: "El correo electrónico es obligatorio." };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(val.trim())) {
    return {
      valid: false,
      message: "Formato no válido (ejemplo: usuario@forestguard.co).",
    };
  }
  return { valid: true, message: "Formato de correo electrónico válido." };
}

/* Componente de contraseña con botón para alternar visibilidad */
function PasswordFieldInput({
  id,
  showPassword,
  onTogglePassword,
  value,
  onChange,
  ...props
}) {
  return (
    <div className="fg-password-input-wrap">
      <input
        id={id}
        name="password"
        type={showPassword ? "text" : "password"}
        value={value}
        onChange={onChange}
        required
        placeholder="Mínimo 8 caracteres seguros"
        autoComplete="new-password"
        className="w-full rounded-lg border border-white/25 bg-[#08111f] p-2 pr-11 text-white placeholder-slate-500 focus:border-[#b9e75c] focus:outline-none"
        {...props}
      />
      <button
        type="button"
        tabIndex={0}
        onClick={onTogglePassword}
        className="fg-password-toggle-btn"
        aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
        title={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
      >
        {showPassword ? (
          <LuEyeOff size={16} aria-hidden="true" />
        ) : (
          <LuEye size={16} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

export function Users() {
  const { can, user: currentUser } = useAuth();
  const canCreateAdministrator =
    can("accounts.add_user") &&
    can("auth.change_group") &&
    isAdministrator(currentUser || {});
  const canAssignRoles = can("auth.change_group") && can("auth.view_group");
  const roles = useResource(can("auth.view_group") ? "admin/roles/" : null);
  const roleOptions = [
    { value: "", label: "Todos" },
    ...(roles.data || []).map((role) => ({
      value: String(role.id),
      label: roleLabel(role),
    })),
  ];
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [order, setOrder] = useState("username");

  const [edit, setEdit] = useState(null);
  const [detailUser, setDetailUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showAdministratorForm, setShowAdministratorForm] = useState(false);

  // Form states
  const [formUsername, setFormUsername] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formStatus, setFormStatus] = useState("true");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState("");

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [enabledCriteria, setEnabledCriteria] = useState([]);
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!popoverOpen) return undefined;
    function handleOutsideClick(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setPopoverOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setPopoverOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [popoverOpen]);

  const apiPage = Math.floor((page - 1) / 2) + 1;
  const sliceStart = ((page - 1) % 2) * PAGE_LIMIT;

  const query = useResource(
    `admin/users/?page=${apiPage}&search=${encodeURIComponent(search)}&ordering=${order}&role_id=${roleFilter}&is_active=${statusFilter}`,
  );

  const totalCount = query.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_LIMIT));
  const results = (query.data?.results || []).slice(
    sliceStart,
    sliceStart + PAGE_LIMIT,
  );
  const rangeStart = results.length > 0 ? (page - 1) * PAGE_LIMIT + 1 : 0;
  const rangeEnd =
    results.length > 0 ? (page - 1) * PAGE_LIMIT + results.length : 0;

  const hasPrevious = page > 1;
  const hasNext = page < totalPages;

  const activeFilters = [
    search && {
      key: "search",
      label: "Búsqueda",
      value: search,
      clear: () => {
        setSearch("");
        setSearchInput("");
        setPage(1);
      },
    },
    roleFilter && {
      key: "role",
      label: "Rol",
      value:
        roleOptions.find((option) => option.value === roleFilter)?.label ||
        "Rol seleccionado",
      clear: () => {
        setRoleFilter("");
        setPage(1);
      },
    },
    statusFilter !== "" && {
      key: "status",
      label: "Estado",
      value: statusFilter === "true" ? "Activo" : "Inactivo",
      clear: () => {
        setStatusFilter("");
        setPage(1);
      },
    },
  ].filter(Boolean);

  function toggleCriterion(key) {
    if (enabledCriteria.includes(key)) {
      setEnabledCriteria((prev) => prev.filter((item) => item !== key));
      if (key === "search") {
        setSearch("");
        setSearchInput("");
      }
      if (key === "role") setRoleFilter("");
      if (key === "status") setStatusFilter("");
      setPage(1);
    } else {
      setEnabledCriteria((prev) => [...prev, key]);
    }
  }

  function resetAllFilters() {
    setSearch("");
    setSearchInput("");
    setRoleFilter("");
    setStatusFilter("");
    setEnabledCriteria([]);
    setPage(1);
  }

  function openCreateModal() {
    setEdit(null);
    setFormUsername("");
    setFormEmail("");
    setFormPassword("");
    setShowPassword(false);
    setFormStatus("true");
    setShowForm(true);
    setError(null);
  }

  function openEditModal(targetUser) {
    if (
      !can("accounts.change_user") ||
      (targetUser.is_superuser && !currentUser?.is_superuser)
    )
      return;
    setEdit(targetUser);
    setFormUsername(targetUser.username || "");
    setFormEmail(targetUser.email || "");
    setFormPassword("");
    setShowPassword(false);
    setFormStatus(String(targetUser.is_active ?? true));
    setShowForm(true);
    setError(null);
    setMessage("");
  }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage("");
    const form = e.currentTarget;
    const body = Object.fromEntries(new FormData(form));

    const isSelf = edit && currentUser?.id === edit.id;
    body.is_active = isSelf
      ? edit.is_active
      : (body.is_active || formStatus) === "true";
    if (canAssignRoles && !isSelf)
      body.role_ids = new FormData(form).getAll("role_ids").map(Number);

    try {
      await saveUser(body, edit?.id);
      setEdit(null);
      setShowForm(false);
      form.reset();
      query.reload();
      setMessage("Usuario guardado.");
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const isSelfEditing = edit && currentUser?.id === edit.id;
  const usernameFeedback = formUsername ? validateUsername(formUsername) : null;
  const emailFeedback = formEmail ? validateEmail(formEmail) : null;

  const passwordReqs = [
    {
      key: "minLen",
      label: "Mínimo 8 caracteres",
      met: formPassword.length >= 8,
    },
    {
      key: "upper",
      label: "Al menos una letra mayúscula",
      met: /[A-Z]/.test(formPassword),
    },
    {
      key: "number",
      label: "Al menos un número",
      met: /[0-9]/.test(formPassword),
    },
    {
      key: "symbol",
      label: "Al menos un símbolo o carácter especial",
      met: /[^A-Za-z0-9]/.test(formPassword),
    },
  ];

  return (
    <Page
      title="Usuarios"
      description="Gestiona las cuentas y permisos de tu equipo. Las cuentas se desactivan para conservar la trazabilidad de sus áreas de estudio y análisis."
      action={
        <div className="flex flex-wrap gap-3">
          {canCreateAdministrator && (
            <Button
              variant="secondary"
              onClick={() => {
                setShowAdministratorForm(true);
                setMessage("");
              }}
            >
              Crear administrador
            </Button>
          )}
          {can("accounts.add_user") && (
            <button
              type="button"
              className="fg-dash-primary-cta"
              onClick={openCreateModal}
            >
              <LuPlus size={17} aria-hidden="true" />
              <span>Nuevo usuario</span>
            </button>
          )}
        </div>
      }
    >
      <Notice>{message}</Notice>
      <Notice error={query.error} />
      {query.error && <Button onClick={query.reload}>Reintentar</Button>}

      <Panel>
        <div className="fg-hist-unified-shell">
          {/* Barra superior integrada */}
          <div className="fg-hist-toolbar-strip">
            <div className="fg-hist-toolbar-left">
              <span className="fg-hist-toolbar-title">Cuentas del equipo</span>
              <span className="fg-hist-toolbar-count" role="status">
                {query.loading
                  ? "Cargando usuarios…"
                  : `${results.length} de ${totalCount}`}
              </span>

              {activeFilters.length > 0 && (
                <div
                  className="fg-hist-inline-tags"
                  aria-label="Filtros aplicados"
                >
                  {activeFilters.map((chip) => (
                    <span key={chip.key} className="fg-hist-inline-tag">
                      <span>{chip.label}:</span>
                      <strong>{chip.value}</strong>
                      <button
                        type="button"
                        aria-label={`Quitar filtro de ${chip.label}`}
                        onClick={chip.clear}
                      >
                        <LuX size={12} />
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    className="fg-hist-clear-inline"
                    onClick={resetAllFilters}
                  >
                    Restablecer
                  </button>
                </div>
              )}
            </div>

            {/* Ordenamiento + Filtros desplegables */}
            <div className="fg-img-toolbar-right">
              <div
                className="fg-img-table-sort"
                role="group"
                aria-label="Ordenar usuarios"
              >
                <button
                  type="button"
                  onClick={() => {
                    setOrder("username");
                    setPage(1);
                  }}
                  className={`fg-img-sort-pill ${order === "username" ? "is-active" : ""}`}
                >
                  <LuArrowDownAZ size={13} aria-hidden="true" />
                  <span>A–Z</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOrder("-date_joined");
                    setPage(1);
                  }}
                  className={`fg-img-sort-pill ${order === "-date_joined" ? "is-active" : ""}`}
                >
                  <LuArrowDownWideNarrow size={13} aria-hidden="true" />
                  <span>Más recientes</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOrder("date_joined");
                    setPage(1);
                  }}
                  className={`fg-img-sort-pill ${order === "date_joined" ? "is-active" : ""}`}
                >
                  <LuArrowUpNarrowWide size={13} aria-hidden="true" />
                  <span>Más antiguos</span>
                </button>
              </div>

              <div className="fg-hist-popover-anchor" ref={popoverRef}>
                <button
                  type="button"
                  aria-expanded={popoverOpen}
                  aria-haspopup="dialog"
                  onClick={() => setPopoverOpen((open) => !open)}
                  className={`fg-hist-popover-btn ${popoverOpen || activeFilters.length > 0 ? "is-active" : ""}`}
                >
                  <LuFilter size={14} aria-hidden="true" />
                  <span>Filtros</span>
                  {activeFilters.length > 0 && (
                    <span className="fg-hist-popover-badge">
                      {activeFilters.length}
                    </span>
                  )}
                  <LuChevronDown
                    size={14}
                    className={`fg-hist-filter-chevron ${popoverOpen ? "is-rotated" : ""}`}
                    aria-hidden="true"
                  />
                </button>

                {popoverOpen && (
                  <div
                    className="fg-hist-popover"
                    role="dialog"
                    aria-label="Filtrar cuentas de usuario"
                  >
                    <div className="fg-hist-popover-head">
                      <div>
                        <strong>Filtrar usuarios</strong>
                        <small>Elige los criterios que deseas utilizar</small>
                      </div>
                      {(enabledCriteria.length > 0 ||
                        activeFilters.length > 0) && (
                        <button
                          type="button"
                          className="fg-hist-popover-reset"
                          onClick={resetAllFilters}
                        >
                          <LuRotateCcw size={12} aria-hidden="true" />
                          <span>Limpiar</span>
                        </button>
                      )}
                    </div>

                    <div
                      className="fg-hist-criteria-chips"
                      role="group"
                      aria-label="Criterios disponibles"
                    >
                      {FILTER_CRITERIA.map((criterion) => {
                        const isSelected =
                          enabledCriteria.includes(criterion.key) ||
                          (criterion.key === "search" && Boolean(search)) ||
                          (criterion.key === "role" && Boolean(roleFilter)) ||
                          (criterion.key === "status" && statusFilter !== "");
                        return (
                          <button
                            key={criterion.key}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => toggleCriterion(criterion.key)}
                            className={`fg-hist-criterion-chip ${isSelected ? "is-selected" : ""}`}
                          >
                            {isSelected ? (
                              <LuCheck size={12} aria-hidden="true" />
                            ) : (
                              <LuPlus size={12} aria-hidden="true" />
                            )}
                            <span>{criterion.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {enabledCriteria.length === 0 &&
                      activeFilters.length === 0 && (
                        <p className="fg-hist-popover-empty">
                          Selecciona un criterio arriba para desplegar sus
                          opciones de búsqueda o filtrado.
                        </p>
                      )}

                    <div className="fg-hist-popover-sections">
                      {(enabledCriteria.includes("search") ||
                        Boolean(search)) && (
                        <form
                          className="fg-hist-popover-section"
                          onSubmit={(e) => {
                            e.preventDefault();
                            setSearch(searchInput.trim());
                            setPage(1);
                          }}
                        >
                          <label
                            htmlFor="users-popover-search"
                            className="fg-hist-popover-label"
                          >
                            Usuario, nombre o correo
                          </label>
                          <div className="fg-hist-popover-search">
                            <LuSearch
                              size={14}
                              className="fg-hist-popover-search-icon"
                              aria-hidden="true"
                            />
                            <input
                              id="users-popover-search"
                              name="search"
                              type="search"
                              value={searchInput}
                              onChange={(e) => setSearchInput(e.target.value)}
                              placeholder="Ej. analyst, correo@dominio.com"
                            />
                            <button type="submit">Aplicar</button>
                          </div>
                        </form>
                      )}

                      {(enabledCriteria.includes("role") ||
                        Boolean(roleFilter)) && (
                        <div className="fg-hist-popover-section">
                          <span className="fg-hist-popover-label">
                            Rol en la plataforma
                          </span>
                          <div className="fg-hist-segmented-options">
                            {roleOptions.map((opt) => (
                              <button
                                key={opt.value || "all"}
                                type="button"
                                onClick={() => {
                                  setRoleFilter(opt.value);
                                  setPage(1);
                                }}
                                className={`fg-hist-seg-btn ${roleFilter === opt.value ? "is-active" : ""}`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {(enabledCriteria.includes("status") ||
                        statusFilter !== "") && (
                        <div className="fg-hist-popover-section">
                          <span className="fg-hist-popover-label">
                            Estado de acceso
                          </span>
                          <div className="fg-hist-segmented-options">
                            {STATUS_OPTIONS.map((opt) => (
                              <button
                                key={opt.value || "all"}
                                type="button"
                                onClick={() => {
                                  setStatusFilter(opt.value);
                                  setPage(1);
                                }}
                                className={`fg-hist-seg-btn ${statusFilter === opt.value ? "is-active" : ""}`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tabla de usuarios */}
          {query.loading && results.length === 0 && (
            <div
              className="space-y-3 p-4"
              role="status"
              aria-label="Cargando lista de usuarios"
            >
              {[1, 2, 3, 4].map((row) => (
                <div key={row} className="fg-record">
                  <div className="space-y-2 flex-1">
                    <span className="fg-skeleton fg-skeleton-pill" />
                    <span className="fg-skeleton fg-skeleton-title" />
                    <span className="fg-skeleton fg-skeleton-line" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {results.length > 0 && (
            <div className="fg-hist-table-wrap is-attached overflow-x-auto">
              <table className="fg-table fg-hist-table">
                <thead>
                  <tr>
                    <th scope="col">Cuenta</th>
                    <th scope="col">Nombre</th>
                    <th scope="col">Rol</th>
                    <th scope="col">Registro</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((item) => {
                    const fullName =
                      `${item.first_name || ""} ${item.last_name || ""}`.trim();
                    const isSelf = currentUser?.id === item.id;
                    const isAdminRole = isAdministrator(item);

                    return (
                      <tr key={item.id}>
                        <td>
                          <div className="fg-user-account-cell">
                            <span
                              className={`fg-user-avatar ${isAdminRole ? "is-admin" : ""}`}
                              aria-hidden="true"
                            >
                              {getInitials(item)}
                            </span>
                            <div className="fg-user-account-copy">
                              <div className="fg-user-name-row">
                                <strong className="fg-hist-item-title">
                                  {item.username}
                                </strong>
                                {isSelf && (
                                  <span className="fg-user-self-badge">Tú</span>
                                )}
                              </div>
                              <small className="fg-user-email">
                                {item.email}
                              </small>
                            </div>
                          </div>
                        </td>

                        <td>
                          {fullName ? (
                            <span className="fg-user-fullname">{fullName}</span>
                          ) : (
                            <span className="fg-img-size-text">
                              Sin nombre registrado
                            </span>
                          )}
                        </td>

                        <td>
                          <span
                            className={`fg-user-role-badge ${isAdminRole ? "is-admin" : "is-analyst"}`}
                          >
                            {isAdminRole ? (
                              <LuShieldCheck size={13} aria-hidden="true" />
                            ) : (
                              <LuUserRound size={13} aria-hidden="true" />
                            )}
                            <span>{roleNames(item)}</span>
                          </span>
                        </td>

                        <td>
                          <div className="fg-user-date-cell">
                            <LuCalendarDays size={14} aria-hidden="true" />
                            <span>{formatJoinDate(item.date_joined)}</span>
                          </div>
                        </td>

                        <td>
                          <span
                            className={`fg-status fg-status-${item.is_active ? "completed" : "failed"}`}
                          >
                            <span aria-hidden="true" />
                            {item.is_active ? "Activo" : "Inactivo"}
                          </span>
                        </td>

                        <td>
                          <div className="fg-img-subtle-actions">
                            <button
                              type="button"
                              className="fg-img-subtle-action"
                              aria-label={`Ver detalles de ${item.username}`}
                              onClick={() => setDetailUser(item)}
                            >
                              <LuEye size={14} aria-hidden="true" />
                              <span>Detalles</span>
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              className="fg-img-subtle-action"
                              aria-label={`Editar ${item.username}`}
                              disabled={
                                !can("accounts.change_user") ||
                                (item.is_superuser &&
                                  !currentUser?.is_superuser)
                              }
                              title={
                                item.is_superuser && !currentUser?.is_superuser
                                  ? "Solo un superusuario puede modificar esta cuenta."
                                  : undefined
                              }
                              onClick={() => openEditModal(item)}
                            >
                              <LuPencil size={14} aria-hidden="true" />
                              <span>Editar</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!query.loading && results.length === 0 && (
            <div className="p-5">
              <EmptyState
                title={
                  activeFilters.length > 0
                    ? "No se encontraron cuentas con ese criterio"
                    : "No hay usuarios registrados"
                }
                action={
                  activeFilters.length > 0 ? (
                    <Button variant="secondary" onClick={resetAllFilters}>
                      Mostrar todos los usuarios
                    </Button>
                  ) : can("accounts.add_user") ? (
                    <Button onClick={openCreateModal}>Nuevo usuario</Button>
                  ) : null
                }
              >
                {activeFilters.length > 0
                  ? "Prueba limpiando la búsqueda o cambiando los filtros de rol y estado."
                  : "Crea la primera cuenta para habilitar el acceso de un analista o administrador."}
              </EmptyState>
            </div>
          )}

          {/* Paginación sutil de máximo 10 elementos */}
          {totalCount > 0 && (
            <div className="fg-subtle-pagination">
              <span className="fg-subtle-pagination-range">
                Mostrando{" "}
                <strong>
                  {rangeStart}–{rangeEnd}
                </strong>{" "}
                de <strong>{totalCount}</strong> usuarios · Página{" "}
                <strong>{page}</strong> de <strong>{totalPages}</strong> (máx.{" "}
                {PAGE_LIMIT} por página)
              </span>

              <div className="fg-subtle-pagination-controls">
                <button
                  type="button"
                  className="fg-subtle-page-btn"
                  disabled={!hasPrevious || query.loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <LuArrowLeft size={14} aria-hidden="true" />
                  <span>Anterior</span>
                </button>
                <button
                  type="button"
                  className="fg-subtle-page-btn"
                  disabled={!hasNext || query.loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <span>Siguiente</span>
                  <LuArrowRight size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>
      </Panel>

      {/* Modal de detalles de usuario */}
      {detailUser && (
        <Modal
          title="Ficha de cuenta de usuario"
          onClose={() => setDetailUser(null)}
        >
          <div className="fg-meta-modal">
            <div className="fg-meta-hero">
              <div className="fg-meta-hero-icon" aria-hidden="true">
                {isAdministrator(detailUser) ? (
                  <LuShieldCheck size={22} />
                ) : (
                  <LuUserRound size={22} />
                )}
              </div>
              <div className="fg-meta-hero-copy">
                <div className="fg-meta-hero-badges">
                  <span
                    className={`fg-status fg-status-${detailUser.is_active ? "completed" : "failed"}`}
                  >
                    <span aria-hidden="true" />
                    {detailUser.is_active ? "Activo" : "Inactivo"}
                  </span>
                  <span className="fg-img-tech-chip">
                    {roleNames(detailUser)}
                  </span>
                  {currentUser?.id === detailUser.id && (
                    <span className="fg-user-self-badge">Sesión actual</span>
                  )}
                </div>
                <h3 className="fg-meta-hero-title">@{detailUser.username}</h3>
              </div>
            </div>

            <dl className="fg-meta-grid">
              <div className="fg-meta-card">
                <dt>Nombre de usuario</dt>
                <dd>{detailUser.username}</dd>
              </div>
              <div className="fg-meta-card">
                <dt>Correo electrónico</dt>
                <dd>{detailUser.email}</dd>
              </div>
              <div className="fg-meta-card">
                <dt>Nombre completo</dt>
                <dd>
                  {`${detailUser.first_name || ""} ${detailUser.last_name || ""}`.trim() ||
                    "Sin nombre registrado"}
                </dd>
              </div>
              <div className="fg-meta-card">
                <dt>Fecha de registro</dt>
                <dd>{formatJoinDate(detailUser.date_joined)}</dd>
              </div>
              <div className="fg-meta-card">
                <dt>Nivel de acceso</dt>
                <dd>
                  Acceso según los roles asignados: {roleNames(detailUser)}
                </dd>
              </div>
              <div className="fg-meta-card">
                <dt>Estado operativo</dt>
                <dd>
                  {detailUser.is_active
                    ? "Habilitado para iniciar sesión"
                    : "Cuenta desactivada (estudios preservados)"}
                </dd>
              </div>
            </dl>

            <div className="fg-meta-footer">
              <div className="fg-delete-actions w-full border-0 pt-0">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setDetailUser(null)}
                >
                  Cerrar
                </Button>
                <Button
                  type="button"
                  disabled={
                    !can("accounts.change_user") ||
                    (detailUser.is_superuser && !currentUser?.is_superuser)
                  }
                  onClick={() => {
                    const target = detailUser;
                    setDetailUser(null);
                    openEditModal(target);
                  }}
                >
                  <LuPencil size={15} aria-hidden="true" />
                  <span>Editar cuenta</span>
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {showAdministratorForm && (
        <AdministratorForm
          canCreateSuperuser={currentUser?.is_superuser}
          onClose={() => setShowAdministratorForm(false)}
          onSaved={(account) => {
            setShowAdministratorForm(false);
            resetAllFilters();
            query.reload();
            setMessage(
              account.is_superuser
                ? "Superusuario creado."
                : "Administrador creado con todos los permisos de ForestGuard.",
            );
          }}
        />
      )}
      {/* Modal de creación o edición de usuario */}
      {showForm && (
        <Modal
          title={edit ? `Editar ${edit.username}` : "Crear usuario"}
          size="wide"
          busy={busy}
          onClose={() => setShowForm(false)}
        >
          <form
            key={edit?.id || "new"}
            onSubmit={submit}
            className="fg-user-modal-form"
          >
            <div className="fg-meta-hero">
              <div className="fg-meta-hero-icon" aria-hidden="true">
                {edit ? <LuUserCheck size={22} /> : <LuUserPlus size={22} />}
              </div>
              <div className="fg-meta-hero-copy">
                <div className="fg-meta-hero-badges">
                  <span className="fg-img-tech-chip">
                    {edit
                      ? "Actualización de perfil y permisos"
                      : "Alta de nuevo integrante"}
                  </span>
                  {isSelfEditing && (
                    <span className="fg-user-self-badge">Tu propia cuenta</span>
                  )}
                </div>
                <p className="fg-user-modal-subtitle">
                  {edit
                    ? "Modifica los datos de contacto, el rol operativo o el estado de acceso de esta cuenta."
                    : "Completa la información del nuevo usuario. Los requisitos de seguridad y el formato se validan en tiempo real."}
                </p>
              </div>
            </div>

            <fieldset disabled={busy} className="fg-user-form-fieldset">
              <div className="grid gap-5 md:grid-cols-2">
                {/* Campo Usuario con validación en tiempo real */}
                <div className="fg-user-field-wrap">
                  <Field
                    label="Usuario"
                    name="username"
                    required
                    placeholder="Ej. analista_meta"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                  />
                  {usernameFeedback && (
                    <div
                      className={`fg-field-feedback ${usernameFeedback.valid ? "is-valid" : "is-invalid"}`}
                      role="status"
                    >
                      {usernameFeedback.valid ? (
                        <LuCheck size={13} aria-hidden="true" />
                      ) : (
                        <LuCircleAlert size={13} aria-hidden="true" />
                      )}
                      <span>{usernameFeedback.message}</span>
                    </div>
                  )}
                </div>

                {/* Campo Correo con validación de formato en tiempo real */}
                <div className="fg-user-field-wrap">
                  <Field
                    label="Correo"
                    name="email"
                    type="email"
                    required
                    placeholder="usuario@forestguard.co"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                  />
                  {emailFeedback && (
                    <div
                      className={`fg-field-feedback ${emailFeedback.valid ? "is-valid" : "is-invalid"}`}
                      role="status"
                    >
                      {emailFeedback.valid ? (
                        <LuCheck size={13} aria-hidden="true" />
                      ) : (
                        <LuCircleAlert size={13} aria-hidden="true" />
                      )}
                      <span>{emailFeedback.message}</span>
                    </div>
                  )}
                </div>

                {/* Nombre */}
                <Field
                  label="Nombre"
                  name="first_name"
                  placeholder="Nombre"
                  defaultValue={edit?.first_name}
                />

                {/* Apellido */}
                <Field
                  label="Apellido"
                  name="last_name"
                  placeholder="Apellido"
                  defaultValue={edit?.last_name}
                />

                {/* Contraseña inicial (solo en creación) con toggle de ver y checklist de requisitos */}
                {!edit && (
                  <div className="md:col-span-2">
                    <Field label="Contraseña inicial">
                      <PasswordFieldInput
                        showPassword={showPassword}
                        onTogglePassword={() =>
                          setShowPassword((prev) => !prev)
                        }
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                      />
                    </Field>

                    {/* Checklist interactivo de requisitos de contraseña */}
                    <div
                      className="fg-password-checklist"
                      role="group"
                      aria-label="Requisitos de contraseña"
                    >
                      <span className="fg-password-checklist-title">
                        Requisitos de seguridad requeridos:
                      </span>
                      <ul className="fg-password-req-list">
                        {passwordReqs.map((req) => (
                          <li
                            key={req.key}
                            className={`fg-password-req-item ${req.met ? "is-met" : "is-pending"}`}
                          >
                            <span
                              className="fg-password-req-icon"
                              aria-hidden="true"
                            >
                              {req.met ? (
                                <LuCheck size={13} />
                              ) : (
                                <span className="fg-password-req-dot" />
                              )}
                            </span>
                            <span className="fg-password-req-text">
                              {req.label}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {canAssignRoles && (
                  <fieldset
                    disabled={isSelfEditing}
                    className="space-y-3 rounded-lg border border-white/15 p-3 md:col-span-2"
                  >
                    <legend className="px-2 font-semibold">
                      Roles asignados
                    </legend>
                    <Notice error={roles.error}>
                      {roles.loading
                        ? "Consultando roles…"
                        : "Los permisos de los roles seleccionados se combinan."}
                    </Notice>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {roles.data?.map((role) => (
                        <label
                          className="flex items-center gap-3 p-2"
                          key={role.id}
                        >
                          <input
                            type="checkbox"
                            name="role_ids"
                            value={role.id}
                            defaultChecked={
                              edit
                                ? edit.roles?.some(
                                    (item) => item.id === role.id,
                                  )
                                : role.name === "analyst"
                            }
                          />
                          {role.name}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}
                {/* Estado de acceso */}
                <div>
                  <Field label="Estado">
                    <Select
                      name="is_active"
                      value={formStatus}
                      disabled={isSelfEditing}
                      onChange={(e) => setFormStatus(e.target.value)}
                    >
                      <option value="true">Activo</option>
                      <option value="false">Inactivo</option>
                    </Select>
                  </Field>
                </div>
              </div>

              {/* Mensaje de protección si edita su propia cuenta */}
              {isSelfEditing && (
                <div className="fg-user-self-protected-note" role="note">
                  <LuShieldAlert size={17} aria-hidden="true" />
                  <span>
                    El rol y el estado de tu propia cuenta de administrador
                    están protegidos y no pueden modificarse desde esta sesión.
                  </span>
                </div>
              )}

              <Notice error={error} />

              <div className="fg-delete-actions">
                {edit ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowForm(false)}
                  >
                    Cancelar edición
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowForm(false)}
                  >
                    Cancelar
                  </Button>
                )}
                <Button
                  disabled={
                    busy ||
                    (canAssignRoles && (roles.loading || Boolean(roles.error)))
                  }
                >
                  Guardar usuario
                </Button>
              </div>
            </fieldset>
          </form>
        </Modal>
      )}
    </Page>
  );
}
