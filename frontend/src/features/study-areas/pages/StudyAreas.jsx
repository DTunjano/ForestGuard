import { useAuth } from "../../auth/hooks/useAuth";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import {
  LuArrowDownAZ,
  LuArrowDownWideNarrow,
  LuArrowLeft,
  LuArrowRight,
  LuArrowUpNarrowWide,
  LuArrowUpRight,
  LuCalendarDays,
  LuChevronDown,
  LuEye,
  LuMapPin,
  LuPencil,
  LuPlus,
  LuRotateCcw,
  LuSearch,
  LuTrash2,
  LuTrees,
  LuX,
} from "react-icons/lu";
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
  EmptyState,
} from "../../../shared/components/UI";

const PAGE_LIMIT = 10;

export function StudyAreas() {
  const { can } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [order, setOrder] = useState("-created_at");
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const [popoverOpen, setPopoverOpen] = useState(false);
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

  // El backend entrega bloques de 20 registros; mapeamos cada página visual a máximo 10 elementos
  const apiPage = Math.floor((page - 1) / 2) + 1;
  const sliceStart = ((page - 1) % 2) * PAGE_LIMIT;

  const query = useResource(
    `study-areas/?page=${apiPage}&search=${encodeURIComponent(search)}&ordering=${order}`,
  );

  const rawResults = query.data?.results || [];
  const totalCount = query.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_LIMIT));

  const results = rawResults.slice(sliceStart, sliceStart + PAGE_LIMIT);

  const rangeStart = results.length > 0 ? (page - 1) * PAGE_LIMIT + 1 : 0;
  const rangeEnd =
    results.length > 0 ? (page - 1) * PAGE_LIMIT + results.length : 0;

  const hasPrevious = page > 1;
  const hasNext = page < totalPages;

  function saved() {
    setDialog(null);
    setPage(1);
    query.reload();
    setMessage("Área guardada.");
  }

  function clearSearch() {
    setSearchInput("");
    setSearch("");
    setPage(1);
  }

  return (
    <Page
      title="Áreas de estudio"
      description="Organiza los territorios de monitoreo donde agrupas tus escenas Sentinel-2 GeoTIFF y ejecutas tus análisis multitemporales."
      action={
        <button
          type="button"
          className="fg-dash-primary-cta"
          onClick={() => setDialog({ type: "form" })}
          disabled={!can("catalog.add_studyarea")}
        >
          <LuPlus size={17} aria-hidden="true" />
          <span>Nueva área</span>
        </button>
      }
    >
      <Notice>{message}</Notice>
      <Notice error={query.error} />
      {query.error && <Button onClick={query.reload}>Reintentar</Button>}

      <Panel>
        {/* Contenedor unificado de tabla + barra superior con ordenamiento junto a búsqueda */}
        <div className="fg-hist-unified-shell">
          <div className="fg-hist-toolbar-strip">
            <div className="fg-hist-toolbar-left">
              <span className="fg-hist-toolbar-title">
                Territorios registrados
              </span>
              <span className="fg-hist-toolbar-count" role="status">
                {query.loading
                  ? "Cargando áreas…"
                  : `${results.length} de ${totalCount}`}
              </span>

              {search && (
                <div
                  className="fg-hist-inline-tags"
                  aria-label="Búsqueda aplicada actualmente"
                >
                  <span className="fg-hist-inline-tag">
                    <span>Búsqueda:</span>
                    <strong>{search}</strong>
                    <button
                      type="button"
                      aria-label="Quitar búsqueda de área"
                      onClick={clearSearch}
                    >
                      <LuX size={12} />
                    </button>
                  </span>
                  <button
                    type="button"
                    className="fg-hist-clear-inline"
                    onClick={clearSearch}
                  >
                    Ver todas
                  </button>
                </div>
              )}
            </div>

            {/* Selector de orden al lado del botón de búsqueda */}
            <div className="fg-img-toolbar-right">
              <div
                className="fg-img-table-sort"
                role="group"
                aria-label="Ordenar áreas de estudio"
              >
                <button
                  type="button"
                  onClick={() => {
                    setOrder("-created_at");
                    setPage(1);
                  }}
                  className={`fg-img-sort-pill ${order === "-created_at" ? "is-active" : ""}`}
                >
                  <LuArrowDownWideNarrow size={13} aria-hidden="true" />
                  <span>Más recientes</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOrder("created_at");
                    setPage(1);
                  }}
                  className={`fg-img-sort-pill ${order === "created_at" ? "is-active" : ""}`}
                >
                  <LuArrowUpNarrowWide size={13} aria-hidden="true" />
                  <span>Más antiguas</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOrder("name");
                    setPage(1);
                  }}
                  className={`fg-img-sort-pill ${order === "name" ? "is-active" : ""}`}
                >
                  <LuArrowDownAZ size={13} aria-hidden="true" />
                  <span>A–Z</span>
                </button>
              </div>

              <div className="fg-hist-popover-anchor" ref={popoverRef}>
                <button
                  type="button"
                  aria-expanded={popoverOpen}
                  aria-haspopup="dialog"
                  onClick={() => setPopoverOpen((open) => !open)}
                  className={`fg-hist-popover-btn ${popoverOpen || Boolean(search) ? "is-active" : ""}`}
                >
                  <LuSearch size={14} aria-hidden="true" />
                  <span>Buscar área</span>
                  {search && <span className="fg-hist-popover-badge">1</span>}
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
                    aria-label="Buscar áreas de estudio"
                  >
                    <div className="fg-hist-popover-head">
                      <div>
                        <strong>Buscar territorio</strong>
                        <small>
                          Filtra por nombre, departamento o municipio
                        </small>
                      </div>
                      {search && (
                        <button
                          type="button"
                          className="fg-hist-popover-reset"
                          onClick={() => {
                            clearSearch();
                            setPopoverOpen(false);
                          }}
                        >
                          <LuRotateCcw size={12} aria-hidden="true" />
                          <span>Limpiar</span>
                        </button>
                      )}
                    </div>

                    <form
                      className="fg-hist-popover-section"
                      onSubmit={(e) => {
                        e.preventDefault();
                        setSearch(searchInput.trim());
                        setPage(1);
                        setPopoverOpen(false);
                      }}
                    >
                      <label
                        htmlFor="fg-area-search-input"
                        className="fg-hist-popover-label"
                      >
                        Buscar áreas
                      </label>
                      <div className="fg-hist-popover-search">
                        <LuSearch
                          size={14}
                          className="fg-hist-popover-search-icon"
                          aria-hidden="true"
                        />
                        <input
                          id="fg-area-search-input"
                          name="search"
                          type="search"
                          value={searchInput}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSearchInput(val);
                            if (val === "" && search !== "") {
                              setSearch("");
                              setPage(1);
                            }
                          }}
                          placeholder="Ej. Cundinamarca, Macarena…"
                        />
                        <button type="submit">Buscar</button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tabla profesional de áreas de estudio */}
          <div className="fg-hist-table-wrap is-attached">
            <table className="fg-table fg-hist-table">
              <thead>
                <tr>
                  <th scope="col">Área</th>
                  <th scope="col">Ubicación</th>
                  <th scope="col">Fecha de registro</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {query.loading &&
                  results.length === 0 &&
                  [1, 2, 3, 4].map((rowKey) => (
                    <tr key={rowKey} aria-hidden="true">
                      <td>
                        <span className="fg-skeleton fg-skeleton-title" />
                      </td>
                      <td>
                        <span className="fg-skeleton fg-skeleton-chip" />
                      </td>
                      <td>
                        <span className="fg-skeleton fg-skeleton-chip" />
                      </td>
                      <td>
                        <span className="fg-skeleton fg-skeleton-pill" />
                      </td>
                    </tr>
                  ))}

                {results.map((area) => {
                  const locationText = [area.department, area.municipality]
                    .filter(Boolean)
                    .join(" · ");

                  return (
                    <tr key={area.id}>
                      <td>
                        <strong className="fg-hist-item-title">
                          {area.name}
                        </strong>
                      </td>

                      <td>
                        {locationText ? (
                          <span className="fg-img-area-chip">
                            <LuMapPin size={12} aria-hidden="true" />
                            {locationText}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">
                            Sin ubicación registrada
                          </span>
                        )}
                      </td>

                      <td>
                        <div className="fg-hist-date-cell">
                          <span>
                            <LuCalendarDays size={13} aria-hidden="true" />
                            {area.created_at
                              ? new Date(area.created_at).toLocaleDateString(
                                  "es-CO",
                                )
                              : "—"}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="fg-img-subtle-actions">
                          <button
                            type="button"
                            className="fg-img-subtle-action"
                            onClick={() => setDialog({ type: "detail", area })}
                          >
                            <LuEye size={14} aria-hidden="true" />
                            <span>Ver detalle</span>
                          </button>
                          <button
                            type="button"
                            className="fg-img-subtle-action"
                            onClick={() => setDialog({ type: "form", area })}
                            disabled={!can("catalog.change_studyarea")}
                          >
                            <LuPencil size={14} aria-hidden="true" />
                            <span>Editar</span>
                          </button>
                          <button
                            type="button"
                            className="fg-img-subtle-action is-danger"
                            onClick={() => setDialog({ type: "delete", area })}
                            disabled={!can("catalog.delete_studyarea")}
                          >
                            <LuTrash2 size={14} aria-hidden="true" />
                            <span>Eliminar</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {!query.loading && results.length === 0 && (
          <EmptyState title="No hay áreas que mostrar">
            {search
              ? "Ningún territorio coincide con tu búsqueda. Limpia el filtro para ver todas tus áreas."
              : "Crea tu primera área de estudio para empezar a registrar imágenes Sentinel-2."}
          </EmptyState>
        )}

        {/* Paginación sutil unificada (máximo 10 elementos por página) */}
        <nav className="fg-subtle-pagination" aria-label="Páginas de áreas">
          <span className="fg-subtle-pagination-range">
            {totalCount > 0 ? (
              <>
                Mostrando{" "}
                <strong>
                  {rangeStart}–{rangeEnd}
                </strong>{" "}
                de <strong>{totalCount}</strong> áreas en catálogo
              </>
            ) : (
              "0 áreas registradas"
            )}
          </span>

          <div className="fg-subtle-pagination-controls">
            <button
              type="button"
              className="fg-subtle-page-btn"
              disabled={!hasPrevious}
              onClick={() => setPage((p) => p - 1)}
            >
              <LuArrowLeft size={14} aria-hidden="true" />
              <span>Anterior</span>
            </button>
            <span className="fg-subtle-page-indicator">
              Página <strong>{page}</strong> de <strong>{totalPages}</strong>
            </span>
            <button
              type="button"
              className="fg-subtle-page-btn"
              disabled={!hasNext}
              onClick={() => setPage((p) => p + 1)}
            >
              <span>Siguiente</span>
              <LuArrowRight size={14} aria-hidden="true" />
            </button>
          </div>
        </nav>
      </Panel>

      {dialog?.type === "form" && (
        <Modal
          size="wide"
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
          <div className="fg-meta-modal">
            <div className="fg-meta-hero">
              <div className="fg-meta-hero-icon" aria-hidden="true">
                <LuTrees size={22} />
              </div>
              <div className="fg-meta-hero-copy">
                <div className="fg-meta-hero-badges">
                  <span className="fg-hist-id-pill">
                    Territorio #{dialog.area.id}
                  </span>
                  <span className="fg-img-scl-badge has-scl">
                    Activo para monitoreo
                  </span>
                </div>
                <h3 className="fg-meta-hero-title">{dialog.area.name}</h3>
              </div>
            </div>

            <dl className="fg-meta-grid">
              <div className="fg-meta-card">
                <dt>Departamento</dt>
                <dd>{dialog.area.department || "No registrado"}</dd>
              </div>
              <div className="fg-meta-card">
                <dt>Municipio</dt>
                <dd>{dialog.area.municipality || "No registrado"}</dd>
              </div>
              <div className="fg-meta-card">
                <dt>Fecha de creación</dt>
                <dd>
                  {dialog.area.created_at
                    ? new Date(dialog.area.created_at).toLocaleDateString(
                        "es-CO",
                      )
                    : "No disponible"}
                </dd>
              </div>
              <div className="fg-meta-card">
                <dt>Cobertura asociada</dt>
                <dd>Escenas Sentinel-2 GeoTIFF</dd>
              </div>
            </dl>

            <div className="fg-img-modal-bands">
              <span className="fg-img-modal-bands-title">
                <LuMapPin size={13} aria-hidden="true" />
                Descripción y referencias del territorio
              </span>
              <p className="m-0 text-sm leading-relaxed text-slate-300">
                {dialog.area.description ||
                  "Sin descripción adicional registrada para este territorio."}
              </p>
            </div>

            <div className="fg-meta-footer gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDialog(null)}
              >
                Cerrar
              </Button>
              <Link
                className="fg-dash-primary-cta"
                to={`/images?area=${dialog.area.id}`}
              >
                <span>Ver imágenes del área</span>
                <LuArrowUpRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </div>
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
            if (results.length === 1 && page > 1) setPage((p) => p - 1);
            else query.reload();
          }}
        />
      )}
    </Page>
  );
}
