import { useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../../auth/hooks/useAuth";
import { useResource } from "../../../shared/api/useResource";
import {
  Button,
  EmptyState,
  Field,
  Notice,
  Page,
  Panel,
  Select,
} from "../../../shared/components/UI";
import { DeleteConfirmation } from "../../../shared/components/DeleteConfirmation";
import { ModelForm } from "../components/ModelForm";
import { deleteModel } from "../api/models";

export function AdminModels() {
  const { can } = useAuth();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ search: "", active: "" });
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [message, setMessage] = useState("");
  const query = useResource(
    `admin/models/?page=${page}&search=${encodeURIComponent(filters.search)}${filters.active ? `&active=${filters.active}` : ""}`,
  );
  return (
    <Page
      title="Gestión de modelos"
      description="Administra el catálogo y la disponibilidad de los clasificadores. Sus versiones y resultados históricos se conservan."
      action={
        <Link className="fg-dash-primary-cta" to="/models">
          Ver catálogo de modelos
        </Link>
      }
    >
      <div className="fg-module-toolbar">
        <p>Los modelos inactivos no se ofrecen en nuevos análisis.</p>
        {can("catalog.add_pipelinemodel") && (
          <Button
            onClick={() => {
              setEditing({});
              setMessage("");
            }}
          >
            Registrar modelo
          </Button>
        )}
      </div>
      <Notice>{message}</Notice>
      <Panel>
        <form
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            setFilters({
              search: form.get("search"),
              active: form.get("active"),
            });
            setPage(1);
          }}
        >
          <Field label="Buscar modelos" name="search" />
          <Field label="Filtrar por disponibilidad">
            <Select name="active" defaultValue="">
              <option value="">Todos los modelos</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </Select>
          </Field>
          <div className="flex items-end">
            <Button>Buscar modelos</Button>
          </div>
        </form>
        <Notice error={query.error}>
          {query.loading
            ? "Consultando modelos…"
            : `${query.data?.count ?? 0} ${query.data?.count === 1 ? "modelo encontrado" : "modelos encontrados"}`}
        </Notice>
        {query.error && (
          <Button onClick={query.reload}>Reintentar consulta</Button>
        )}
        {!!query.data?.results.length && (
          <div className="overflow-x-auto">
            <table className="fg-table">
              <thead>
                <tr>
                  <th scope="col">Modelo</th>
                  <th scope="col">Disponibilidad</th>
                  <th scope="col">Análisis vinculados</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {query.data.results.map((model) => (
                  <tr key={model.id}>
                    <td>
                      <strong>{model.name}</strong>
                      <small className="block text-slate-400">
                        {model.version} · {model.algorithm}
                      </small>
                    </td>
                    <td>
                      <span
                        className={`fg-status fg-status-${model.active ? "completed" : "queued"}`}
                      >
                        {model.active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td>{model.analysis_count}</td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          disabled={!can("catalog.change_pipelinemodel")}
                          onClick={() => {
                            setEditing(model);
                            setMessage("");
                          }}
                        >
                          Editar {model.version}
                        </Button>
                        <Button
                          variant="danger"
                          disabled={
                            !can("catalog.delete_pipelinemodel") ||
                            model.analysis_count > 0
                          }
                          onClick={() => setRemoving(model)}
                        >
                          Eliminar {model.version}
                        </Button>
                      </div>
                      {model.analysis_count > 0 && (
                        <small className="mt-2 block text-slate-400">
                          Tiene análisis asociados; puedes desactivarlo.
                        </small>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!query.loading && !query.error && query.data?.count === 0 && (
          <EmptyState title="No hay modelos con estos filtros">
            Registra un paquete instalado o ajusta la búsqueda.
          </EmptyState>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            disabled={!query.data?.previous}
            onClick={() => setPage((value) => value - 1)}
          >
            Anterior
          </Button>
          <span>Página {page}</span>
          <Button
            disabled={!query.data?.next}
            onClick={() => setPage((value) => value + 1)}
          >
            Siguiente
          </Button>
        </div>
      </Panel>
      {editing && (
        <ModelForm
          model={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            query.reload();
            setMessage(
              "Modelo guardado. La disponibilidad se aplica a nuevos análisis.",
            );
          }}
        />
      )}
      {removing && (
        <DeleteConfirmation
          name={removing.name}
          explanation="Se elimina el registro del catálogo. El paquete instalado se conserva y los modelos usados en análisis están protegidos."
          onClose={() => setRemoving(null)}
          onDelete={async () => {
            await deleteModel(removing.id);
            setRemoving(null);
            setPage(1);
            query.reload();
            setMessage("Registro de modelo eliminado.");
          }}
        />
      )}
    </Page>
  );
}
