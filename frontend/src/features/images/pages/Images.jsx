import { useAuth } from "../../auth/hooks/useAuth";
import { useEffect, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router";
import {
  LuArrowDownWideNarrow,
  LuArrowLeft,
  LuArrowRight,
  LuArrowUpNarrowWide,
  LuCalendarDays,
  LuCheck,
  LuChevronDown,
  LuEye,
  LuLayers,
  LuMapPin,
  LuPlus,
  LuRotateCcw,
  LuSatellite,
  LuSlidersHorizontal,
  LuTrash2,
  LuX,
} from "react-icons/lu";
import { useCollection } from "../../../shared/api/useCollection";
import { useResource } from "../../../shared/api/useResource";
import { deleteImage } from "../api/images";
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

function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "No disponible";
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatScale(scale) {
  if (scale === "divide_10000") return "Reflectancia ÷ 10 000 (enteros)";
  if (scale === "unit_float") return "Reflectancia normalizada (0–1)";
  return scale || "Estándar";
}

export function Images() {
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const area = params.get("area") || "";
  const areas = useCollection(
    can("catalog.view_studyarea") ? "study-areas/?ordering=name" : null,
  );

  const [page, setPage] = useState(1);
  const [ordering, setOrdering] = useState("-acquisition_date");
  const [dialog, setDialog] = useState(null);
  const [message, setMessage] = useState("");

  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!popoverOpen) return undefined;
    function handleOutsideClick(event) {
      if (event.target.closest?.(".fg-select-menu")) return;
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
    `images/?page=${apiPage}&ordering=${ordering}${area ? `&study_area=${encodeURIComponent(area)}` : ""}`,
  );

  const areaList = areas.data || [];
  const areaMap = new Map(areaList.map((item) => [String(item.id), item.name]));
  const selectedAreaName = area
    ? areaMap.get(String(area)) || `Área #${area}`
    : "";

  const rawResults = query.data?.results || [];
  const totalCount = query.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_LIMIT));

  const results = rawResults.slice(sliceStart, sliceStart + PAGE_LIMIT);

  const rangeStart = results.length > 0 ? (page - 1) * PAGE_LIMIT + 1 : 0;
  const rangeEnd =
    results.length > 0 ? (page - 1) * PAGE_LIMIT + results.length : 0;

  const hasPrevious = page > 1;
  const hasNext = page < totalPages;

  function setAreaFilter(nextArea) {
    if (nextArea) {
      setParams({ area: String(nextArea) });
    } else {
      setParams({});
    }
    setPage(1);
  }

  return (
    <Page
      title="Imágenes satelitales"
      action={
        can("analyses.add_analysis") && (
          <Link className="fg-dash-primary-cta" to="/dashboard/new">
            <LuPlus size={17} aria-hidden="true" />
            <span>Crear análisis</span>
          </Link>
        )
      }
    >
      <Notice error={areas.error} />
      <Notice error={query.error}>{message}</Notice>
      {query.error && <Button onClick={query.reload}>Reintentar</Button>}

      <Panel>
        {/* Contenedor unificado de tabla + barra superior con ordenamiento junto al filtro */}
        <div className="fg-hist-unified-shell">
          <div className="fg-hist-toolbar-strip">
            <div className="fg-hist-toolbar-left">
              <span className="fg-hist-toolbar-title">
                Colección de escenas
              </span>
              <span className="fg-hist-toolbar-count" role="status">
                {query.loading
                  ? "Cargando imágenes…"
                  : `${results.length} de ${totalCount}`}
              </span>

              {area && (
                <div
                  className="fg-hist-inline-tags"
                  aria-label="Área filtrada actualmente"
                >
                  <span className="fg-hist-inline-tag">
                    <span>Área:</span>
                    <strong>{selectedAreaName}</strong>
                    <button
                      type="button"
                      aria-label="Quitar filtro de área"
                      onClick={() => setAreaFilter("")}
                    >
                      <LuX size={12} />
                    </button>
                  </span>
                  <button
                    type="button"
                    className="fg-hist-clear-inline"
                    onClick={() => setAreaFilter("")}
                  >
                    Ver todas
                  </button>
                </div>
              )}
            </div>

            {/* Selector de Más recientes / Más antiguas al lado del botón de filtrado */}
            <div className="fg-img-toolbar-right">
              <div
                className="fg-img-table-sort"
                role="group"
                aria-label="Ordenar por fecha de adquisición"
              >
                <button
                  type="button"
                  onClick={() => {
                    setOrdering("-acquisition_date");
                    setPage(1);
                  }}
                  className={`fg-img-sort-pill ${ordering === "-acquisition_date" ? "is-active" : ""}`}
                >
                  <LuArrowDownWideNarrow size={13} aria-hidden="true" />
                  <span>Más recientes</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOrdering("acquisition_date");
                    setPage(1);
                  }}
                  className={`fg-img-sort-pill ${ordering === "acquisition_date" ? "is-active" : ""}`}
                >
                  <LuArrowUpNarrowWide size={13} aria-hidden="true" />
                  <span>Más antiguas</span>
                </button>
              </div>

              <div className="fg-hist-popover-anchor" ref={popoverRef}>
                <button
                  type="button"
                  aria-expanded={popoverOpen}
                  aria-haspopup="dialog"
                  onClick={() => setPopoverOpen((open) => !open)}
                  className={`fg-hist-popover-btn ${popoverOpen || Boolean(area) ? "is-active" : ""}`}
                >
                  <LuSlidersHorizontal size={14} aria-hidden="true" />
                  <span>Filtrar por área</span>
                  {area && <span className="fg-hist-popover-badge">1</span>}
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
                    aria-label="Filtrar imágenes por área de estudio"
                  >
                    <div className="fg-hist-popover-head">
                      <div>
                        <strong>Filtrar por área de estudio</strong>
                        <small>
                          Selecciona un territorio para ver sus escenas
                        </small>
                      </div>
                      {area && (
                        <button
                          type="button"
                          className="fg-hist-popover-reset"
                          onClick={() => {
                            setAreaFilter("");
                            setPopoverOpen(false);
                          }}
                        >
                          <LuRotateCcw size={12} aria-hidden="true" />
                          <span>Todas</span>
                        </button>
                      )}
                    </div>

                    <div
                      className="fg-img-area-filter-list"
                      role="listbox"
                      aria-label="Filtrar por área"
                    >
                      <button
                        type="button"
                        role="option"
                        aria-selected={!area}
                        onClick={() => {
                          setAreaFilter("");
                          setPopoverOpen(false);
                        }}
                        className={`fg-img-area-filter-option ${!area ? "is-selected" : ""}`}
                      >
                        <span>Todas las áreas</span>
                        {!area && <LuCheck size={14} aria-hidden="true" />}
                      </button>

                      {areaList.map((item) => {
                        const isSelected = String(area) === String(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => {
                              setAreaFilter(String(item.id));
                              setPopoverOpen(false);
                            }}
                            className={`fg-img-area-filter-option ${isSelected ? "is-selected" : ""}`}
                          >
                            <span className="flex items-center gap-2 truncate">
                              <LuMapPin size={13} aria-hidden="true" />
                              <span className="truncate">{item.name}</span>
                            </span>
                            {isSelected && (
                              <LuCheck size={14} aria-hidden="true" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tabla simplificada con acciones sutiles y claras */}
          <div className="fg-hist-table-wrap is-attached">
            <table className="fg-table fg-hist-table">
              <thead>
                <tr>
                  <th scope="col">Imagen</th>
                  <th scope="col">Área de estudio</th>
                  <th scope="col">Fecha de adquisición</th>
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

                {results.map((image) => {
                  const areaTitle =
                    areaMap.get(String(image.study_area)) ||
                    `Área #${image.study_area}`;

                  return (
                    <tr key={image.id}>
                      <td>
                        <strong className="fg-image-name fg-hist-item-title">
                          {image.name}
                        </strong>
                      </td>

                      <td>
                        <span className="fg-img-area-chip">
                          <LuMapPin size={12} aria-hidden="true" />
                          {areaTitle}
                        </span>
                      </td>

                      <td>
                        <div className="fg-hist-date-cell">
                          <span>
                            <LuCalendarDays size={13} aria-hidden="true" />
                            {image.acquisition_date}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="fg-img-subtle-actions">
                          <button
                            type="button"
                            className="fg-img-subtle-action"
                            onClick={() => setDialog({ type: "detail", image })}
                          >
                            <LuEye size={14} aria-hidden="true" />
                            <span>Ver metadatos</span>
                          </button>
                          <button
                            type="button"
                            className="fg-img-subtle-action is-danger"
                            onClick={() => setDialog({ type: "delete", image })}
                            disabled={!can("catalog.delete_satelliteimage")}
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
          <EmptyState title="Sin imágenes en esta colección">
            {area
              ? "Esta área aún no tiene escenas registradas en el catálogo."
              : "Aún no hay escenas Sentinel-2 registradas en tu colección."}
          </EmptyState>
        )}

        {/* Paginación sutil unificada (máximo 10 por página) */}
        <nav className="fg-subtle-pagination" aria-label="Páginas de imágenes">
          <span className="fg-subtle-pagination-range">
            {totalCount > 0 ? (
              <>
                Mostrando{" "}
                <strong>
                  {rangeStart}–{rangeEnd}
                </strong>{" "}
                de <strong>{totalCount}</strong> escenas en colección
              </>
            ) : (
              "0 escenas registradas"
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

      {dialog?.type === "detail" && (
        <Modal title="Metadatos de la imagen" onClose={() => setDialog(null)}>
          <div className="fg-meta-modal">
            {/* Cabecera destacada de la escena */}
            <div className="fg-meta-hero">
              <div className="fg-meta-hero-icon" aria-hidden="true">
                <LuSatellite size={22} />
              </div>
              <div className="fg-meta-hero-copy">
                <div className="fg-meta-hero-badges">
                  <span className="fg-hist-id-pill">
                    Escena #{dialog.image.id}
                  </span>
                  <span className="fg-img-area-chip">
                    <LuMapPin size={11} aria-hidden="true" />
                    {areaMap.get(String(dialog.image.study_area)) ||
                      `Área #${dialog.image.study_area}`}
                  </span>
                  <span
                    className={`fg-img-scl-badge ${dialog.image.scl_factor ? "has-scl" : "no-scl"}`}
                  >
                    {dialog.image.scl_factor
                      ? "Compatible con ML v9 (SCL)"
                      : "Solo índices espectrales"}
                  </span>
                </div>
                <h3 className="fg-meta-hero-title">{dialog.image.name}</h3>
              </div>
            </div>

            {/* Cuadrícula técnica de especificaciones */}
            <dl className="fg-meta-grid">
              {[
                ["Fecha de adquisición", dialog.image.acquisition_date],
                [
                  "Cobertura válida",
                  dialog.image.valid_coverage_percent == null
                    ? "Se verificará antes del análisis"
                    : `${dialog.image.valid_coverage_percent.toLocaleString("es-CO", { maximumFractionDigits: 2 })} %`,
                ],
                [
                  "Dimensiones",
                  `${dialog.image.width} × ${dialog.image.height} px`,
                ],
                ["Sistema de referencia (CRS)", dialog.image.crs],
                ["Tamaño de archivo", formatSize(dialog.image.size_bytes)],
                [
                  "Reflectancia detectada",
                  formatScale(dialog.image.reflectance_scale),
                ],
                ["Factor SCL", dialog.image.scl_factor ?? "Sin banda SCL"],
                [
                  "Fecha de registro",
                  dialog.image.uploaded_at
                    ? new Date(dialog.image.uploaded_at).toLocaleString("es-CO")
                    : "No disponible",
                ],
                ["Bandas", dialog.image.band_descriptions.join(", ")],
              ].map(([name, value]) => (
                <div key={name} className="fg-meta-card">
                  <dt>{name}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>

            {/* Desglose visual de bandas */}
            <div className="fg-img-modal-bands">
              <div className="fg-meta-bands-header">
                <span className="fg-img-modal-bands-title">
                  <LuLayers size={13} aria-hidden="true" />
                  Bandas espectrales verificadas (
                  {dialog.image.band_descriptions?.length || 0})
                </span>
                <small>Sentinel-2 GeoTIFF multibanda</small>
              </div>
              <div className="fg-upload-bands-list">
                {dialog.image.band_descriptions?.map((band, idx) => (
                  <span
                    key={`${band}-${idx}`}
                    className={`fg-upload-band-pill ${band === "SCL" ? "is-scl" : ""}`}
                  >
                    {band}
                  </span>
                ))}
              </div>
            </div>

            <div className="fg-meta-footer">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDialog(null)}
              >
                Cerrar ficha técnica
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {dialog?.type === "delete" && (
        <DeleteConfirmation
          name="imagen"
          explanation={`Se eliminará permanentemente la escena «${dialog.image.name}» de tu catálogo. Las imágenes vinculadas a un análisis existente están protegidas y no pueden eliminarse.`}
          onClose={() => setDialog(null)}
          onDelete={async () => {
            await deleteImage(dialog.image.id);
            setDialog(null);
            setMessage("Imagen eliminada.");
            if (results.length === 1 && page > 1) setPage((p) => p - 1);
            else query.reload();
          }}
        />
      )}
    </Page>
  );
}
