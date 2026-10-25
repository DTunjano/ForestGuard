import { useState } from "react";
import { useAuth } from "../../auth/hooks/useAuth";
import { request } from "../../../shared/api/client";
import { useResource } from "../../../shared/api/useResource";
import {
  Button,
  Field,
  Notice,
  Page,
  Panel,
} from "../../../shared/components/UI";
import { Modal } from "../../../shared/components/Modal";

const actions = {
  view: "Consultar",
  add: "Crear",
  change: "Modificar / asignar",
  delete: "Eliminar",
};
const modules = {
  user: "Usuarios",
  group: "Roles",
  studyarea: "Áreas de estudio",
  satelliteimage: "Imágenes",
  pipelinemodel: "Modelos",
  analysis: "Análisis y resultados",
};

export function Roles() {
  const query = useResource("admin/roles/");
  const permissions = useResource("admin/permissions/");
  const { can } = useAuth();
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState("");
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const body = {
      name: form.get("name"),
      description: form.get("description"),
    };
    if (!editing.is_system)
      body.permission_ids = form.getAll("permissions").map(Number);
    try {
      await request(`admin/roles/${editing.id ? editing.id + "/" : ""}`, {
        method: editing.id ? "PATCH" : "POST",
        body,
      });
      setEditing(null);
      query.reload();
      setMessage(
        "Rol guardado. Los permisos se aplican en las siguientes solicitudes del usuario.",
      );
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await request(`admin/roles/${editing.id}/`, { method: "DELETE" });
      setEditing(null);
      query.reload();
      setMessage("Rol eliminado.");
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page
      title="Roles y permisos"
      description="Define el acceso a cada módulo y asigna los roles desde Usuarios. Los recursos personales conservan su propietario."
    >
      <Notice error={query.error || permissions.error}>{message}</Notice>
      <div className="fg-module-toolbar">
        <p>Un usuario puede tener varios roles. Sus permisos se combinan.</p>
        {can("auth.add_group") && (
          <Button
            onClick={() => {
              setEditing({ permission_ids: [] });
              setError(null);
            }}
          >
            Crear rol
          </Button>
        )}
      </div>
      <Panel>
        <div className="overflow-x-auto">
          <table className="fg-table">
            <thead>
              <tr>
                <th scope="col">Rol</th>
                <th scope="col">Permisos</th>
                <th scope="col">Usuarios</th>
                <th scope="col">Acción</th>
              </tr>
            </thead>
            <tbody>
              {query.data?.map((role) => (
                <tr key={role.id}>
                  <td>
                    <strong>{role.name}</strong>
                    <small className="block text-slate-400">
                      {role.description ||
                        (role.is_system
                          ? "Rol base del sistema"
                          : "Rol personalizado")}
                    </small>
                  </td>
                  <td>{role.permission_ids.length}</td>
                  <td>{role.users_count}</td>
                  <td>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setEditing(role);
                        setError(null);
                      }}
                    >
                      Ver / editar {role.name}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!query.loading && !query.data?.length && (
          <p>No hay roles disponibles.</p>
        )}
      </Panel>
      {editing && (
        <Modal
          title={editing.id ? `Rol: ${editing.name}` : "Crear rol"}
          busy={busy}
          onClose={() => setEditing(null)}
        >
          <form onSubmit={save} className="space-y-4">
            <fieldset
              disabled={
                busy ||
                !can(editing.id ? "auth.change_group" : "auth.add_group")
              }
              className="space-y-4"
            >
              <Field
                label="Nombre del rol"
                name="name"
                required
                maxLength={150}
                defaultValue={editing.name}
                readOnly={editing.is_system}
              />
              <Field
                label="Descripción"
                name="description"
                maxLength={1000}
                defaultValue={editing.description}
              />
              {editing.is_system && (
                <p className="text-sm text-slate-400">
                  El nombre y los permisos de los roles base están protegidos.
                  Crea un rol personalizado para otro conjunto de permisos.
                </p>
              )}
              <fieldset
                disabled={editing.is_system || permissions.loading}
                className="space-y-4"
              >
                <legend className="mb-3 font-semibold">
                  Permisos por módulo
                </legend>
                {Object.entries(modules).map(([module, label]) => (
                  <fieldset
                    key={module}
                    className="rounded-lg border border-white/15 p-3"
                  >
                    <legend className="px-2">{label}</legend>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {permissions.data
                        ?.filter((permission) => permission.module === module)
                        .map((permission) => (
                          <label
                            key={permission.id}
                            className="flex items-center gap-3 rounded p-2 focus-within:ring-2 focus-within:ring-green-400"
                          >
                            <input
                              type="checkbox"
                              name="permissions"
                              value={permission.id}
                              defaultChecked={editing.permission_ids.includes(
                                permission.id,
                              )}
                            />
                            {actions[
                              permission.code.split(".")[1].split("_")[0]
                            ] || permission.name}
                          </label>
                        ))}
                    </div>
                  </fieldset>
                ))}
              </fieldset>
              <Button disabled={permissions.loading}>Guardar rol</Button>
            </fieldset>
          </form>
          {editing.id && !editing.is_system && can("auth.delete_group") && (
            <div className="border-t border-white/10 pt-4">
              <p className="mb-3 text-sm">
                La eliminación requiere que el rol no tenga usuarios asignados.
              </p>
              <Button
                variant="secondary"
                disabled={busy || editing.users_count > 0}
                onClick={remove}
              >
                Eliminar rol {editing.name}
              </Button>
            </div>
          )}
          <Notice error={error} />
        </Modal>
      )}
    </Page>
  );
}
