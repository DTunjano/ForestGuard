import { Modal } from "../../../shared/components/Modal";
import { useAuth } from "../../auth/hooks/useAuth";
import { useState } from "react";
import { useResource } from "../../../shared/api/useResource";
import { saveUser } from "../api/users";
import {
  Page,
  Panel,
  Field,
  Button,
  Notice,
  Select,
} from "../../../shared/components/UI";
export function Users() {
  const { can } = useAuth();
  const canAssignRoles = can("auth.change_group") && can("auth.view_group");
  const roles = useResource(canAssignRoles ? "admin/roles/" : null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [edit, setEdit] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const query = useResource(
    `admin/users/?page=${page}&search=${encodeURIComponent(search)}&ordering=username`,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState("");
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage("");
    const form = e.currentTarget;
    const body = Object.fromEntries(new FormData(form));
    delete body.role_ids;
    if (canAssignRoles)
      body.role_ids = new FormData(form).getAll("role_ids").map(Number);
    body.is_active = body.is_active === "true";
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
  return (
    <Page title="Usuarios">
      <div className="fg-module-toolbar">
        <p>
          Gestiona las cuentas de tu equipo. Las cuentas se desactivan para
          conservar sus estudios.
        </p>
        <Button
          disabled={!can("accounts.add_user")}
          onClick={() => {
            setEdit(null);
            setShowForm(true);
            setError(null);
          }}
        >
          Nuevo usuario
        </Button>
      </div>
      <Notice>{message}</Notice>
      <Panel>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(new FormData(e.currentTarget).get("search"));
            setPage(1);
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <Field label="Buscar usuarios" name="search" />
          <Button>Buscar</Button>
        </form>
        <Notice error={query.error}>
          {query.loading
            ? "Cargando usuarios…"
            : `${query.data?.count ?? 0} usuarios`}
        </Notice>
        <div className="overflow-x-auto">
          <table className="fg-table">
            <thead>
              <tr>
                <th scope="col">Cuenta</th>
                <th scope="col">Rol</th>
                <th scope="col">Estado</th>
                <th scope="col">Acción</th>
              </tr>
            </thead>
            <tbody>
              {query.data?.results.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.username}</strong>
                    <small className="block text-slate-400">{user.email}</small>
                  </td>
                  <td>
                    {user.roles?.map((role) => role.name).join(", ") ||
                      "Sin roles"}
                  </td>
                  <td>
                    <span
                      className={`fg-status fg-status-${user.is_active ? "completed" : "failed"}`}
                    >
                      {user.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td>
                    <Button
                      disabled={busy || !can("accounts.change_user")}
                      onClick={() => {
                        setEdit(user);
                        setShowForm(true);
                        setError(null);
                        setMessage("");
                      }}
                    >
                      Editar {user.username}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-3">
          <Button
            disabled={!query.data?.previous}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <span>Página {page}</span>
          <Button
            disabled={!query.data?.next}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      </Panel>
      {showForm && (
        <Modal
          title={edit ? `Editar ${edit.username}` : "Crear usuario"}
          busy={busy}
          onClose={() => setShowForm(false)}
        >
          <form key={edit?.id || "new"} onSubmit={submit}>
            <fieldset disabled={busy} className="grid gap-4 md:grid-cols-2">
              <Field
                label="Usuario"
                name="username"
                required
                defaultValue={edit?.username}
              />
              <Field
                label="Correo"
                name="email"
                type="email"
                required
                defaultValue={edit?.email}
              />
              <Field
                label="Nombre"
                name="first_name"
                defaultValue={edit?.first_name}
              />
              <Field
                label="Apellido"
                name="last_name"
                defaultValue={edit?.last_name}
              />
              {!edit && (
                <Field
                  label="Contraseña inicial"
                  name="password"
                  type="password"
                  required
                  autoComplete="new-password"
                />
              )}
              {canAssignRoles && (
                <fieldset className="space-y-3 rounded-lg border border-white/15 p-3 md:col-span-2">
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
                              ? edit.roles?.some((item) => item.id === role.id)
                              : role.name === "analyst"
                          }
                        />
                        {role.name}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              <Field label="Estado">
                <Select
                  name="is_active"
                  defaultValue={String(edit?.is_active ?? true)}
                >
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </Select>
              </Field>
              <Button
                disabled={
                  busy ||
                  (canAssignRoles && (roles.loading || Boolean(roles.error)))
                }
              >
                Guardar usuario
              </Button>
              {edit && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowForm(false)}
                >
                  Cancelar edición
                </Button>
              )}
            </fieldset>
          </form>
          <Notice error={error} />
        </Modal>
      )}
    </Page>
  );
}
