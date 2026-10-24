import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import {
  LuArrowLeft,
  LuArrowRight,
  LuArrowUpRight,
  LuCalendarDays,
  LuCheck,
  LuChevronDown,
  LuFolderClock,
  LuLayers,
  LuPlus,
  LuRotateCcw,
  LuSatellite,
  LuSearch,
  LuSlidersHorizontal,
  LuTrash2,
  LuX,
} from "react-icons/lu";
import { DeleteConfirmation } from "../../../shared/components/DeleteConfirmation";
import { deleteAnalysis } from "../api/analyses";
import { useResource } from "../../../shared/api/useResource";
import {
  Page,
  Panel,
  Button,
  Notice,
  StatusBadge,
  EmptyState,
} from "../../../shared/components/UI";
import { statusLabel } from "../utils/status";

const ORDER_OPTIONS = [
  { id: "-created_at", label: "Más recientes primero" },
  { id: "created_at", label: "Más antiguos primero" },
  { id: "name", label: "Nombre (A–Z)" },
  { id: "status", label: "Estado del análisis" },
];

const STATUS_OPTIONS = [
  { id: "all", label: "Todos" },
  { id: "completed", label: "Completados" },
  { id: "active", label: "En proceso" },
  { id: "failed", label: "Con fallo" },
];

const MODE_OPTIONS = [
  { id: "all", label: "Todas" },
  { id: "multi", label: "Multitemporal (2+ fechas)" },
  { id: "single", label: "Individual (1 fecha)" },
];

const FILTER_CRITERIA = [
  { key: "search", label: "Búsqueda por texto" },
  { key: "status", label: "Estado" },
  { key: "mode", label: "Modalidad" },
  { key: "ordering", label: "Orden" },
];

export function History() {
  const [remove, setRemove] = useState(null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [ordering, setOrdering] = useState("-created_at");

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [enabledFilters, setEnabledFilters] = useState([]);
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

  const query = useResource(
    `analyses/?page=${page}&search=${encodeURIComponent(search)}&ordering=${ordering}`,
  );

  const rawResults = query.data?.results || [];
  const totalCount = query.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / 10));

  const results = rawResults.filter((item) => {
    const matchesStatus =
      statusFilter === "all"
        ? true
        : statusFilter === "active"
          ? ["queued", "running"].includes(item.status)
          : item.status === statusFilter;
    const matchesMode =
      modeFilter === "all"
        ? true
        : modeFilter === "multi"
          ? item.images.length > 1
          : item.images.length === 1;
    return matchesStatus && matchesMode;
  });

  const rangeStart = rawResults.length > 0 ? (page - 1) * 10 + 1 : 0;
  const rangeEnd =
    rawResults.length > 0 ? (page - 1) * 10 + rawResults.length : 0;

  const completedInPage = rawResults.filter(
    (item) => item.status === "completed",
  ).length;
  const activeInPage = rawResults.filter((item) =>
    ["queued", "running"].includes(item.status),
  ).length;
  const failedInPage = rawResults.filter(
    (item) => item.status === "failed",
  ).length;

  const activeFilterCount =
    (search ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (modeFilter !== "all" ? 1 : 0) +
    (ordering !== "-created_at" ? 1 : 0);

  const hasActiveFilters = activeFilterCount > 0;

  function toggleFilterCriterion(key) {
    setEnabledFilters((current) => {
      const exists = current.includes(key);
      if (exists) {
        if (key === "search") {
          setSearchInput("");
          setSearch("");
          setPage(1);
        } else if (key === "status") {
          setStatusFilter("all");
        } else if (key === "mode") {
          setModeFilter("all");
        } else if (key === "ordering") {
          setOrdering("-created_at");
          setPage(1);
        }
        return current.filter((item) => item !== key);
      }
      return [...current, key];
    });
  }

  function resetAllFilters() {
    setSearchInput("");
    setSearch("");
    setStatusFilter("all");
    setModeFilter("all");
    setOrdering("-created_at");
    setEnabledFilters([]);
    setPage(1);
  }

  return (
    <Page title="Historial de análisis">
      {/* Cabecera ejecutiva del historial */}
      <section className="fg-hist-hero">
        <div className="fg-hist-hero-copy">
          <p className="fg-eyebrow">
            <LuFolderClock aria-hidden="true" /> Registro de estudios
            satelitales
          </p>
          <h2>Archivo y gestión de análisis</h2>
          <p>
            Consulta los estudios realizados sobre tus áreas de estudio, abre
            sus láminas y reportes o depura análisis finalizados. Al eliminar un
            análisis, las escenas GeoTIFF originales se conservan intactas.
          </p>
        </div>

        <div className="fg-hist-hero-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={query.loading}
            onClick={query.reload}
          >
            <LuRotateCcw size={15} aria-hidden="true" />
            <span>Actualizar</span>
          </Button>
          <Link className="fg-dash-primary-cta" to="/dashboard/new">
            <LuPlus size={17} aria-hidden="true" />
            <span>Crear análisis</span>
          </Link>
        </div>
      </section>

      {/* Tarjetas de resumen del historial */}
      <section
        className="fg-hist-stats-grid"
        aria-label="Resumen del historial de análisis"
      >
        <div className="fg-hist-stat-card">
          <div className="fg-hist-stat-icon is-lime" aria-hidden="true">
            <LuFolderClock size={18} />
          </div>
          <div>
            <span>Total en el archivo</span>
            <strong>
              {query.loading ? (
                <span className="fg-skeleton fg-skeleton-hist-num" />
              ) : (
                `${totalCount} ${totalCount === 1 ? "estudio" : "estudios"}`
              )}
            </strong>
            <small>Análisis asociados a tu cuenta</small>
          </div>
        </div>

        <div className="fg-hist-stat-card">
          <div className="fg-hist-stat-icon is-emerald" aria-hidden="true">
            <LuCheck size={18} />
          </div>
          <div>
            <span>Completados en página</span>
            <strong>
              {query.loading ? (
                <span className="fg-skeleton fg-skeleton-hist-num" />
              ) : (
                `${completedInPage} de ${rawResults.length || 0}`
              )}
            </strong>
            <small>Con mapas, métricas y PDF listos</small>
          </div>
        </div>

        <div className="fg-hist-stat-card">
          <div className="fg-hist-stat-icon is-sky" aria-hidden="true">
            <LuSatellite size={18} />
          </div>
          <div>
            <span>Estado de la página actual</span>
            <strong>
              {query.loading ? (
                <span className="fg-skeleton fg-skeleton-hist-num" />
              ) : activeInPage > 0 ? (
                `${activeInPage} en proceso`
              ) : failedInPage > 0 ? (
                `${failedInPage} con fallo`
              ) : (
                "Sin tareas en cola"
              )}
            </strong>
            <small>
              {activeInPage > 0
                ? "El worker local está ejecutando estudios"
                : "Todos los trabajos en página finalizaron"}
            </small>
          </div>
        </div>
      </section>

      <Notice>{message}</Notice>

      <Panel>
        <Notice error={query.error} />

        {/* Contenedor unificado de tabla + barra superior minimalista con popover flotante */}
        <div className="fg-hist-unified-shell">
          <div className="fg-hist-toolbar-strip">
            <div className="fg-hist-toolbar-left">
              <span className="fg-hist-toolbar-title">Listado de análisis</span>
              <span className="fg-hist-toolbar-count" role="status">
                {query.loading
                  ? "Actualizando…"
                  : `${results.length} de ${totalCount}`}
              </span>

              {hasActiveFilters && (
                <div
                  className="fg-hist-inline-tags"
                  aria-label="Filtros aplicados actualmente"
                >
                  {search && (
                    <span className="fg-hist-inline-tag">
                      <span>Texto:</span>
                      <strong>{search}</strong>
                      <button
                        type="button"
                        aria-label="Quitar filtro de búsqueda"
                        onClick={() => {
                          setSearchInput("");
                          setSearch("");
                          setPage(1);
                        }}
                      >
                        <LuX size={12} />
                      </button>
                    </span>
                  )}
                  {statusFilter !== "all" && (
                    <span className="fg-hist-inline-tag">
                      <span>Estado:</span>
                      <strong>
                        {
                          STATUS_OPTIONS.find((opt) => opt.id === statusFilter)
                            ?.label
                        }
                      </strong>
                      <button
                        type="button"
                        aria-label="Quitar filtro de estado"
                        onClick={() => setStatusFilter("all")}
                      >
                        <LuX size={12} />
                      </button>
                    </span>
                  )}
                  {modeFilter !== "all" && (
                    <span className="fg-hist-inline-tag">
                      <span>Modalidad:</span>
                      <strong>
                        {modeFilter === "multi"
                          ? "Multitemporal"
                          : "Individual"}
                      </strong>
                      <button
                        type="button"
                        aria-label="Quitar filtro de modalidad"
                        onClick={() => setModeFilter("all")}
                      >
                        <LuX size={12} />
                      </button>
                    </span>
                  )}
                  {ordering !== "-created_at" && (
                    <span className="fg-hist-inline-tag">
                      <span>Orden:</span>
                      <strong>
                        {
                          ORDER_OPTIONS.find((opt) => opt.id === ordering)
                            ?.label
                        }
                      </strong>
                      <button
                        type="button"
                        aria-label="Restablecer orden por defecto"
                        onClick={() => {
                          setOrdering("-created_at");
                          setPage(1);
                        }}
                      >
                        <LuX size={12} />
                      </button>
                    </span>
                  )}
                  <button
                    type="button"
                    className="fg-hist-clear-inline"
                    onClick={resetAllFilters}
                  >
                    Limpiar todo
                  </button>
                </div>
              )}
            </div>

            {/* Menú desplegable flotante que no deforma ni desplaza la tabla */}
            <div className="fg-hist-popover-anchor" ref={popoverRef}>
              <button
                type="button"
                aria-expanded={popoverOpen}
                aria-haspopup="dialog"
                onClick={() => setPopoverOpen((open) => !open)}
                className={`fg-hist-popover-btn ${popoverOpen || hasActiveFilters ? "is-active" : ""}`}
              >
                <LuSlidersHorizontal size={14} aria-hidden="true" />
                <span>Filtrar vista</span>
                {activeFilterCount > 0 && (
                  <span className="fg-hist-popover-badge">
                    {activeFilterCount}
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
                  aria-label="Configuración de filtros del historial"
                >
                  <div className="fg-hist-popover-head">
                    <div>
                      <strong>Filtros personalizados</strong>
                      <small>
                        Elige solo los criterios que quieras aplicar
                      </small>
                    </div>
                    {(hasActiveFilters || enabledFilters.length > 0) && (
                      <button
                        type="button"
                        className="fg-hist-popover-reset"
                        onClick={resetAllFilters}
                      >
                        <LuRotateCcw size={12} aria-hidden="true" />
                        <span>Restablecer</span>
                      </button>
                    )}
                  </div>

                  {/* Selector compacto de qué filtros activar */}
                  <div
                    className="fg-hist-criteria-chips"
                    role="group"
                    aria-label="Criterios de filtrado disponibles"
                  >
                    {FILTER_CRITERIA.map((criterion) => {
                      const isSelected = enabledFilters.includes(criterion.key);
                      return (
                        <button
                          key={criterion.key}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => toggleFilterCriterion(criterion.key)}
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

                  {enabledFilters.length === 0 ? (
                    <p className="fg-hist-popover-empty">
                      Selecciona arriba uno o más criterios para mostrar sus
                      opciones.
                    </p>
                  ) : (
                    <div className="fg-hist-popover-sections">
                      {enabledFilters.includes("search") && (
                        <form
                          className="fg-hist-popover-section"
                          onSubmit={(e) => {
                            e.preventDefault();
                            setSearch(searchInput.trim());
                            setPage(1);
                          }}
                        >
                          <label
                            htmlFor="fg-hist-search-input"
                            className="fg-hist-popover-label"
                          >
                            Buscar por nombre o área
                          </label>
                          <div className="fg-hist-popover-search">
                            <LuSearch
                              size={14}
                              className="fg-hist-popover-search-icon"
                              aria-hidden="true"
                            />
                            <input
                              id="fg-hist-search-input"
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
                              placeholder="Ej. Parque Chingaza…"
                            />
                            <button type="submit">Aplicar</button>
                          </div>
                        </form>
                      )}

                      {enabledFilters.includes("status") && (
                        <div className="fg-hist-popover-section">
                          <span className="fg-hist-popover-label">
                            Estado del análisis
                          </span>
                          <div className="fg-hist-segmented-options">
                            {STATUS_OPTIONS.map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => setStatusFilter(opt.id)}
                                className={`fg-hist-seg-btn ${statusFilter === opt.id ? "is-active" : ""}`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {enabledFilters.includes("mode") && (
                        <div className="fg-hist-popover-section">
                          <span className="fg-hist-popover-label">
                            Modalidad del estudio
                          </span>
                          <div className="fg-hist-segmented-options">
                            {MODE_OPTIONS.map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => setModeFilter(opt.id)}
                                className={`fg-hist-seg-btn ${modeFilter === opt.id ? "is-active" : ""}`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {enabledFilters.includes("ordering") && (
                        <div className="fg-hist-popover-section">
                          <span className="fg-hist-popover-label">
                            Ordenar lista por
                          </span>
                          <div className="fg-hist-segmented-options">
                            {ORDER_OPTIONS.map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                  setOrdering(opt.id);
                                  setPage(1);
                                }}
                                className={`fg-hist-seg-btn ${ordering === opt.id ? "is-active" : ""}`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Tabla principal de análisis integrada sin bordes duplicados */}
          <div className="fg-hist-table-wrap is-attached">
            <table className="fg-table fg-hist-table">
              <thead>
                <tr>
                  <th scope="col">Análisis</th>
                  <th scope="col">Cobertura y escenas</th>
                  <th scope="col">Fecha de creación</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {query.loading &&
                  rawResults.length === 0 &&
                  [1, 2, 3, 4].map((rowKey) => (
                    <tr key={rowKey} aria-hidden="true">
                      <td>
                        <span className="fg-skeleton fg-skeleton-title" />
                      </td>
                      <td>
                        <span className="fg-skeleton fg-skeleton-line" />
                      </td>
                      <td>
                        <span className="fg-skeleton fg-skeleton-chip" />
                      </td>
                      <td>
                        <span className="fg-skeleton fg-skeleton-pill" />
                      </td>
                      <td>
                        <span className="fg-skeleton fg-skeleton-pill" />
                      </td>
                    </tr>
                  ))}

                {results.map((item) => {
                  const dates = item.images.map((i) => i.date);
                  const dateRange =
                    dates.length === 0
                      ? "Sin fechas"
                      : dates.length === 1
                        ? dates[0]
                        : `${dates[0]} → ${dates[dates.length - 1]}`;
                  const canDelete = ["completed", "failed"].includes(
                    item.status,
                  );

                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="fg-hist-name-cell">
                          <div className="flex flex-wrap items-center gap-2">
                            <strong className="fg-hist-item-title">
                              {item.name}
                            </strong>
                            <span className="fg-hist-id-pill">#{item.id}</span>
                          </div>
                          {item.description && (
                            <p className="fg-hist-item-desc">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </td>

                      <td>
                        <div className="fg-hist-coverage-cell">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="fg-hist-scenes-badge">
                              <LuLayers size={12} aria-hidden="true" />
                              {item.images.length}{" "}
                              {item.images.length === 1 ? "fecha" : "fechas"}
                            </span>
                            <span className="fg-hist-mode-chip">
                              {item.images.length > 1
                                ? "Multitemporal"
                                : "Individual"}
                            </span>
                          </div>
                          <small
                            className="fg-hist-dates-range"
                            title={dates.join(" → ")}
                          >
                            {dateRange}
                          </small>
                        </div>
                      </td>

                      <td>
                        <div className="fg-hist-date-cell">
                          <span>
                            <LuCalendarDays size={13} aria-hidden="true" />
                            {new Date(item.created_at).toLocaleDateString(
                              "es-CO",
                            )}
                          </span>
                          <small>
                            {new Date(item.created_at).toLocaleTimeString(
                              "es-CO",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </small>
                        </div>
                      </td>

                      <td>
                        <StatusBadge status={item.status}>
                          {statusLabel(item.status)}
                        </StatusBadge>
                      </td>

                      <td>
                        <div className="fg-hist-row-actions">
                          <Link
                            className="fg-hist-open-btn"
                            to={`/dashboard/results/${item.id}`}
                          >
                            <span>Abrir análisis</span>
                            <LuArrowUpRight size={14} aria-hidden="true" />
                          </Link>
                          <Button
                            variant="danger"
                            disabled={!canDelete}
                            onClick={() => setRemove(item)}
                          >
                            <LuTrash2 size={14} aria-hidden="true" />
                            <span>Eliminar análisis</span>
                          </Button>
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
          <EmptyState
            title={
              hasActiveFilters
                ? "Ningún análisis coincide con los filtros aplicados"
                : "Aún no hay análisis registrados"
            }
          >
            {hasActiveFilters
              ? "Prueba cambiando los criterios seleccionados o pulsa «Limpiar todo» para ver todo tu historial."
              : "Carga tus escenas Sentinel-2 GeoTIFF y ejecuta tu primer estudio satelital para consultarlo aquí."}
          </EmptyState>
        )}

        {/* Paginación sutil y clara */}
        <div className="fg-subtle-pagination">
          <span className="fg-subtle-pagination-range">
            {totalCount > 0 ? (
              <>
                Mostrando{" "}
                <strong>
                  {rangeStart}–{rangeEnd}
                </strong>{" "}
                de <strong>{totalCount}</strong> análisis en catálogo
              </>
            ) : (
              "0 análisis registrados"
            )}
          </span>

          <div className="fg-subtle-pagination-controls">
            <button
              type="button"
              className="fg-subtle-page-btn"
              disabled={!query.data?.previous}
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
              disabled={!query.data?.next}
              onClick={() => setPage((p) => p + 1)}
            >
              <span>Siguiente</span>
              <LuArrowRight size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      </Panel>

      {remove && (
        <DeleteConfirmation
          name={remove.name}
          explanation="Se eliminarán este análisis y sus resultados. Las imágenes originales se conservarán. Solo se pueden eliminar trabajos terminados o fallidos."
          onClose={() => setRemove(null)}
          onDelete={async () => {
            await deleteAnalysis(remove.id);
            setRemove(null);
            setMessage("Análisis eliminado.");
            if (query.data.results.length === 1 && page > 1)
              setPage((p) => p - 1);
            else query.reload();
          }}
        />
      )}
    </Page>
  );
}
