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
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [edit, setEdit] = useState(null);
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
    body.is_active = body.is_active === "true";
    try {
      await saveUser(body, edit?.id);
      setEdit(null);
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
                    {user.role === "admin" ? "Administrador" : "Analista"}
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
                      disabled={busy}
                      onClick={() => {
                        setEdit(user);
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
      <Panel>
        <h2>{edit ? `Editar ${edit.username}` : "Crear usuario"}</h2>
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
            <Field label="Rol">
              <Select name="role" defaultValue={edit?.role || "analyst"}>
                <option value="analyst">Analista</option>
                <option value="admin">Administrador</option>
              </Select>
            </Field>
            <Field label="Estado">
              <Select
                name="is_active"
                defaultValue={String(edit?.is_active ?? true)}
              >
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </Select>
            </Field>
            <Button disabled={busy}>Guardar usuario</Button>
            {edit && (
              <Button type="button" onClick={() => setEdit(null)}>
                Cancelar edición
              </Button>
            )}
          </fieldset>
        </form>
        <Notice error={error}>{message}</Notice>
      </Panel>
    </Page>
  );
}
