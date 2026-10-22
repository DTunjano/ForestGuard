import { useState } from "react";
import { Link } from "react-router";
import { useResource } from "../../../shared/api/useResource";
import {
  Page,
  Panel,
  Button,
  Field,
  Select,
  Notice,
} from "../../../shared/components/UI";
import { statusLabel } from "../utils/status";
export function History() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [ordering, setOrdering] = useState("-created_at");
  const query = useResource(
    `analyses/?page=${page}&search=${encodeURIComponent(search)}&ordering=${ordering}`,
  );
  return (
    <Page title="Historial de análisis">
      <Link className="underline" to="/dashboard/new">
        Crear análisis
      </Link>
      <Panel>
        <form
          className="flex flex-wrap items-end gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(new FormData(e.currentTarget).get("search"));
            setPage(1);
          }}
        >
          <Field label="Buscar por nombre o área" name="search" />
          <Button>Buscar</Button>
          <Field label="Orden">
            <Select
              value={ordering}
              onChange={(e) => {
                setOrdering(e.target.value);
                setPage(1);
              }}
            >
              <option value="-created_at">Más recientes</option>
              <option value="created_at">Más antiguos</option>
              <option value="name">Nombre</option>
              <option value="status">Estado</option>
            </Select>
          </Field>
        </form>
        <Notice error={query.error}>
          {query.loading
            ? "Cargando historial…"
            : `${query.data?.count ?? 0} análisis`}
        </Notice>
        {query.data?.results.map((item) => (
          <article
            key={item.id}
            className="flex flex-wrap justify-between gap-3 border-b border-white/10 py-4"
          >
            <div>
              <h2>{item.name}</h2>
              <p>
                {statusLabel(item.status)} ·{" "}
                {new Date(item.created_at).toLocaleString("es-CO")}
              </p>
            </div>
            <Link
              className="text-[#b9e75c] underline"
              to={`/dashboard/results/${item.id}`}
            >
              Abrir análisis
            </Link>
          </article>
        ))}
        {query.data?.count === 0 && (
          <p>
            Aún no hay análisis que coincidan. Carga imágenes y crea el primero.
          </p>
        )}
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
          <Button onClick={query.reload}>Actualizar</Button>
        </div>
      </Panel>
    </Page>
  );
}
