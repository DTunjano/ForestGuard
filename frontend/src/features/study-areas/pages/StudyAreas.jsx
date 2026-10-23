import { useState } from "react";
import { Link } from "react-router";
import { useResource } from "../../../shared/api/useResource";
import { AreaForm } from "../components/AreaForm";
import { deleteArea } from "../api/areas";
import { Modal } from "../../../shared/components/Modal";
import { DeleteConfirmation } from "../../../shared/components/DeleteConfirmation";
import {
  Page,
  Panel,
  Button,
  Notice,
  Field,
  Select,
  EmptyState,
} from "../../../shared/components/UI";
export function StudyAreas() {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [order, setOrder] = useState("-created_at");
  const [dialog, setDialog] = useState(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const query = useResource(
    `study-areas/?page=${page}&search=${encodeURIComponent(search)}&ordering=${order}`,
  );
  function saved() {
    setDialog(null);
    setPage(1);
    query.reload();
    setMessage("Área guardada.");
  }
  return (
    <Page title="Áreas de estudio">
      <div className="fg-module-toolbar">
        <p>
          Gestiona tus territorios y consulta sus imágenes desde una misma
          colección.
        </p>
        <Button onClick={() => setDialog({ type: "form" })}>Nueva área</Button>
      </div>
      <Notice>{message}</Notice>
      <Panel>
        <form
          className="fg-filter-bar"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(new FormData(e.currentTarget).get("search"));
            setPage(1);
          }}
        >
          <Field label="Buscar áreas" name="search" type="search" />
          <Button>Buscar</Button>
          <Field label="Ordenar áreas">
            <Select
              value={order}
              onChange={(e) => {
                setOrder(e.target.value);
                setPage(1);
              }}
            >
              <option value="-created_at">Más recientes</option>
              <option value="name">Nombre A–Z</option>
              <option value="created_at">Más antiguas</option>
            </Select>
          </Field>
        </form>
        <Notice error={query.error}>
          {query.loading
            ? "Cargando áreas…"
            : query.data
              ? `${query.data.count} áreas encontradas`
              : null}
        </Notice>
        {query.error && <Button onClick={query.reload}>Reintentar</Button>}
        <div className="overflow-x-auto">
          <table className="fg-table">
            <thead>
              <tr>
                <th scope="col">Área</th>
                <th scope="col">Ubicación</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {query.data?.results.map((area) => (
                <tr key={area.id}>
                  <td>
                    <strong>{area.name}</strong>
                  </td>
                  <td>
                    {[area.department, area.municipality]
                      .filter(Boolean)
                      .join(" · ") || "Sin ubicación registrada"}
                  </td>
                  <td>
                    <div className="fg-actions">
                      <Button
                        variant="secondary"
                        onClick={() => setDialog({ type: "detail", area })}
                      >
                        Ver detalle
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setDialog({ type: "form", area })}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => setDialog({ type: "delete", area })}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {query.data?.count === 0 && (
          <EmptyState title="No hay áreas que mostrar">
            Crea tu primera área o cambia los criterios de búsqueda.
          </EmptyState>
        )}
        <nav className="fg-actions" aria-label="Páginas de áreas">
          <Button
            variant="secondary"
            disabled={!query.data?.previous}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <span>Página {page}</span>
          <Button
            variant="secondary"
            disabled={!query.data?.next}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </Button>
        </nav>
      </Panel>
      {dialog?.type === "form" && (
        <Modal
          title={dialog.area ? "Editar área" : "Crear área"}
          busy={busy}
          onClose={() => setDialog(null)}
        >
          <AreaForm
            area={dialog.area}
            onBusy={setBusy}
            onCreated={saved}
            onCancel={() => setDialog(null)}
          />
        </Modal>
      )}
      {dialog?.type === "detail" && (
        <Modal title={dialog.area.name} onClose={() => setDialog(null)}>
          <dl className="fg-details">
            <dt>Departamento</dt>
            <dd>{dialog.area.department || "No registrado"}</dd>
            <dt>Municipio</dt>
            <dd>{dialog.area.municipality || "No registrado"}</dd>
            <dt>Descripción</dt>
            <dd>{dialog.area.description || "Sin descripción"}</dd>
          </dl>
          <Link
            className="fg-button fg-button-primary rounded-lg px-4"
            to={`/images?area=${dialog.area.id}`}
          >
            Ver imágenes del área
          </Link>
        </Modal>
      )}
      {dialog?.type === "delete" && (
        <DeleteConfirmation
          name={dialog.area.name}
          explanation="Esta acción elimina el área. Solo se puede eliminar si no tiene imágenes asociadas. No se eliminarán imágenes ni análisis de forma automática."
          onClose={() => setDialog(null)}
          onDelete={async () => {
            await deleteArea(dialog.area.id);
            setDialog(null);
            setMessage("Área eliminada.");
            if (query.data.results.length === 1 && page > 1)
              setPage((p) => p - 1);
            else query.reload();
          }}
        />
      )}
    </Page>
  );
}
