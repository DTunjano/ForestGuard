import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import {
  LuArrowLeft,
  LuCalendarDays,
  LuDownload,
  LuFileCheck2,
  LuFilter,
  LuFolderArchive,
  LuImage,
  LuLayers,
  LuPlus,
  LuRotateCcw,
  LuSatellite,
  LuSparkles,
} from "react-icons/lu";
import { useResource } from "../../../shared/api/useResource";
import { download } from "../../../shared/api/client";
import {
  Page,
  Panel,
  Field,
  Select,
  Button,
  Notice,
  StatusBadge,
} from "../../../shared/components/UI";
import { statusLabel } from "../../analyses/utils/status";
import { SatelliteProcessingCard } from "../../analyses/components/SatelliteProcessingCard";
import { Metrics } from "../components/Metrics";
import { ArtifactCard } from "../components/ArtifactCard";

export function Results() {
  const { id } = useParams();
  const location = useLocation();
  const query = useResource(`analyses/${id}/`, { poll: true });

  return (
    <Page title={query.data?.name || "Resultados del análisis"}>
      <div className="fg-res-topbar">
        <Link className="fg-res-back-btn" to="/dashboard/history">
          <LuArrowLeft size={16} aria-hidden="true" />
          <span>Volver al historial</span>
        </Link>
        <Link className="fg-res-new-btn" to="/dashboard/new">
          <LuPlus size={15} aria-hidden="true" />
          <span>Nuevo análisis</span>
        </Link>
      </div>

      <Notice error={query.error}>
        {query.loading ? "Consultando análisis…" : null}
      </Notice>
      {query.error && (
        <Button onClick={query.reload}>Reintentar consulta</Button>
      )}

      {query.data && (
        <AnalysisResultContent
          key={id}
          id={id}
          data={query.data}
          fromCreate={Boolean(location.state?.fromCreate)}
        />
      )}
    </Page>
  );
}

function AnalysisResultContent({ id, data, fromCreate }) {
  const navigate = useNavigate();
  const [barDone, setBarDone] = useState(
    () => !fromCreate && data.status === "completed",
  );

  const isFailed = data.status === "failed";
  const showProcessingBar = !isFailed && !barDone;
  const effectiveStatus =
    showProcessingBar && data.status === "completed" ? "running" : data.status;

  return (
    <>
      <Panel>
        <div className="fg-res-executive-header">
          <div className="fg-res-executive-top">
            <div className="fg-res-status-block">
              <span className="fg-eyebrow">
                <LuSatellite aria-hidden="true" /> Estudio satelital #{id}
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <p role="status" className="fg-res-status-text">
                  Estado: {statusLabel(effectiveStatus)}
                </p>
                <span className="fg-res-mode-pill">
                  {data.images.length > 1
                    ? `Serie multitemporal (${data.images.length} fechas)`
                    : "Diagnóstico de 1 fecha"}
                </span>
              </div>
            </div>

            <ol className="fg-processing" aria-label="Etapas del análisis">
              {[
                ["queued", "En cola"],
                ["running", "Procesando"],
                ["completed", "Resultados"],
              ].map(([state, label]) => (
                <li
                  key={state}
                  aria-current={effectiveStatus === state ? "step" : undefined}
                >
                  <StatusBadge
                    status={effectiveStatus === state ? state : undefined}
                  >
                    {label}
                  </StatusBadge>
                </li>
              ))}
            </ol>
          </div>

          <div className="fg-res-meta-grid">
            <div className="fg-res-meta-item">
              <span className="fg-res-meta-icon" aria-hidden="true">
                <LuCalendarDays size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <small>Secuencia temporal analizada</small>
                <p className="fg-res-dates-line">
                  Fechas: {data.images.map((image) => image.date).join(", ")}
                </p>
              </div>
            </div>

            <div className="fg-res-meta-item">
              <span className="fg-res-meta-icon" aria-hidden="true">
                <LuLayers size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <small>Cobertura de escenas</small>
                <strong>
                  {data.images.length}{" "}
                  {data.images.length === 1
                    ? "escena Sentinel-2 procesada"
                    : "escenas Sentinel-2 procesadas"}
                </strong>
              </div>
            </div>
          </div>

          {data.description && (
            <p className="fg-res-description-note">{data.description}</p>
          )}

          {showProcessingBar && (
            <>
              <SatelliteProcessingCard
                status={data.status}
                scenesCount={data.images?.length || 1}
                onComplete={() => setBarDone(true)}
                cancelLabel="Volver al historial"
                onCancel={() => navigate("/dashboard/history")}
              />
              <p className="text-center text-xs text-slate-400">
                Actualización automática activa. Puedes salir y retomar el
                estudio en cualquier momento desde el historial.
              </p>
            </>
          )}

          {isFailed && (
            <Notice
              error={
                data.error_message ||
                "El procesamiento falló. Revisa las imágenes y el worker."
              }
            />
          )}
        </div>
      </Panel>

      {data.status === "completed" && barDone && (
        <CompletedResults key={id} id={id} summary={data.summary} />
      )}
    </>
  );
}

function CompletedResults({ id, summary }) {
  const query = useResource(`analyses/${id}/results/`);
  const [section, setSection] = useState("all");
  const [group, setGroup] = useState("");
  const [index, setIndex] = useState("");
  const [format, setFormat] = useState("both");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const groups = query.data
    ? ["reports", "individual", "comparisons", "other"].flatMap((kind) =>
        query.data[kind].map((artifact) => ({ ...artifact, section: kind })),
      )
    : [];

  const choices = [
    ...new Set(
      groups
        .map((item) =>
          item.relative_path.includes("/")
            ? item.relative_path.split("/")[1]
            : "",
        )
        .filter(Boolean),
    ),
  ];

  const visible = groups.filter(
    (item) =>
      (section === "all" || item.section === section) &&
      (!group || item.relative_path.split("/")[1] === group) &&
      (!index ||
        item.relative_path.toLowerCase().includes(index.toLowerCase())),
  );

  const overviewBoards = visible.filter(
    (item) =>
      item.kind === "visualization" && !item.relative_path.includes("/"),
  );
  const detailedArtifacts = visible.filter(
    (item) => item.kind !== "visualization" || item.relative_path.includes("/"),
  );
  const hasActiveFilters =
    section !== "all" || Boolean(group) || Boolean(index);

  async function exportAll() {
    setBusy(true);
    setError(null);
    try {
      await download(
        query.data[`download_${format}_url`],
        `forestguard-${id}-${format}.zip`,
      );
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fg-res-completed-stack">
      {/* Navegación rápida por secciones para facilitar la lectura */}
      <nav
        className="fg-res-quicknav"
        aria-label="Secciones de los resultados del análisis"
      >
        <a href="#res-export" className="fg-res-quicknav-link">
          <LuFolderArchive size={15} aria-hidden="true" />
          <span>1. Descarga completa</span>
        </a>
        {overviewBoards.length > 0 && (
          <a href="#res-overview" className="fg-res-quicknav-link">
            <LuImage size={15} aria-hidden="true" />
            <span>2. Láminas generales ({overviewBoards.length})</span>
          </a>
        )}
        <a href="#res-metrics" className="fg-res-quicknav-link">
          <LuFileCheck2 size={15} aria-hidden="true" />
          <span>3. Resumen y métricas</span>
        </a>
        <a href="#res-explorer" className="fg-res-quicknav-link">
          <LuFilter size={15} aria-hidden="true" />
          <span>4. Mapas e informes ({detailedArtifacts.length})</span>
        </a>
      </nav>

      {/* 1. Centro de descarga del paquete completo */}
      <div id="res-export">
        <Panel>
          <div className="fg-res-export-card">
            <div className="fg-res-export-info">
              <div className="fg-res-section-icon" aria-hidden="true">
                <LuFolderArchive size={20} />
              </div>
              <div>
                <p className="fg-eyebrow">Exportación directa</p>
                <h2 className="text-xl font-semibold">
                  Descargar análisis completo
                </h2>
                <p className="fg-res-export-desc">
                  Descarga en un solo archivo comprimido (ZIP) todas las láminas
                  disponibles, capas e informes generados en este estudio. Los
                  filtros inferiores afectan únicamente la visualización en
                  pantalla.
                </p>
              </div>
            </div>

            <div className="fg-res-export-controls">
              <div className="fg-res-export-select">
                <Field label="Formato del paquete">
                  <Select
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                  >
                    <option value="both">PNG y GeoTIFF</option>
                    <option value="png">PNG</option>
                    <option value="tiff">GeoTIFF</option>
                  </Select>
                </Field>
              </div>
              <Button disabled={busy || !query.data} onClick={exportAll}>
                <LuDownload size={16} aria-hidden="true" />
                <span>
                  {busy ? "Preparando descarga…" : "Descargar ZIP completo"}
                </span>
              </Button>
            </div>
          </div>
          <Notice error={error} />
        </Panel>
      </div>

      {/* 2. Láminas generales destacadas */}
      {overviewBoards.length > 0 && (
        <section id="res-overview" className="fg-res-section-block">
          <div className="fg-res-block-heading">
            <div>
              <p className="fg-eyebrow">
                <LuSparkles aria-hidden="true" /> Síntesis visual del estudio
              </p>
              <h2>Láminas cartográficas principales</h2>
              <p>
                Vista consolidada de los índices espectrales y comparaciones
                entre fechas. Puedes ocultar o desplegar cada mapa según lo
                necesites.
              </p>
            </div>
          </div>

          <div className="fg-results-overview">
            {overviewBoards.map((artifact, position) => (
              <ArtifactCard
                key={artifact.id}
                artifact={artifact}
                initialOpen={position === 0}
              />
            ))}
          </div>
        </section>
      )}

      {/* 3. Resumen y métricas a ancho completo para lectura cómoda */}
      <section id="res-metrics" className="fg-res-section-block">
        <Panel>
          <div className="fg-res-section-header">
            <div className="fg-res-section-icon" aria-hidden="true">
              <LuFileCheck2 size={20} />
            </div>
            <div>
              <p className="fg-eyebrow">Indicadores cuantitativos</p>
              <h2 className="text-xl font-semibold">Resumen y métricas</h2>
              <p>
                Resultados exploratorios: valores bajos o descensos de índices
                no demuestran por sí solos deforestación. Las superficies de
                fechas e intervalos se presentan separadas y no deben sumarse.
              </p>
            </div>
          </div>

          <Metrics summary={summary || {}} />
        </Panel>
      </section>

      {/* 4. Explorador y filtro de mapas individuales e informes */}
      <section id="res-explorer" className="fg-res-section-block">
        <Panel>
          <div className="fg-res-section-header">
            <div className="fg-res-section-icon" aria-hidden="true">
              <LuFilter size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="fg-eyebrow">Catálogo de artefactos generados</p>
              <h2 className="text-xl font-semibold">Mapas e informes</h2>
              <p>
                Filtra las capas individuales, comparaciones entre fechas,
                archivos GeoTIFF y reportes técnicos en PDF o JSON.
              </p>
            </div>
            {hasActiveFilters && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setSection("all");
                  setGroup("");
                  setIndex("");
                }}
              >
                <LuRotateCcw size={14} aria-hidden="true" />
                <span>Restablecer filtros</span>
              </Button>
            )}
          </div>

          <div className="fg-res-legend-grid">
            <div className="fg-res-legend-card">
              <strong>Escala en escenas individuales</strong>
              <span>
                Tonos ocre–verde o rojo–azul representan valores bajos a altos
                de cada índice en una fecha.
              </span>
            </div>
            <div className="fg-res-legend-card">
              <strong>Escala en comparaciones entre fechas</strong>
              <span>
                Tonos rojos indican descenso del índice y tonos azules indican
                aumento entre la fecha inicial y final.
              </span>
            </div>
          </div>

          <div className="fg-res-filter-grid">
            <Field label="Sección">
              <Select
                value={section}
                onChange={(e) => setSection(e.target.value)}
              >
                <option value="all">Todas</option>
                <option value="reports">Informes PDF / JSON</option>
                <option value="individual">Individuales</option>
                <option value="comparisons">Comparaciones</option>
                <option value="other">Otros</option>
              </Select>
            </Field>
            <Field label="Fecha o intervalo">
              <Select value={group} onChange={(e) => setGroup(e.target.value)}>
                <option value="">Todos, incluidas láminas generales</option>
                {choices.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </Select>
            </Field>
            <Field label="Índice / lámina">
              <Select value={index} onChange={(e) => setIndex(e.target.value)}>
                <option value="">Todos</option>
                {["NDVI", "NDMI", "NBR", "NDRE"].map((value) => (
                  <option key={value}>{value}</option>
                ))}
                <option value="resumen">Láminas por fecha / intervalo</option>
                <option value="visualizacion">Láminas generales</option>
              </Select>
            </Field>
          </div>

          <Notice error={query.error}>
            {query.loading
              ? "Cargando archivos…"
              : `${visible.length} archivos disponibles con estos filtros`}
          </Notice>
          {query.error && <Button onClick={query.reload}>Reintentar</Button>}
        </Panel>

        <div className="fg-res-artifacts-list">
          {detailedArtifacts.map((artifact) => (
            <ArtifactCard key={artifact.id} artifact={artifact} />
          ))}
        </div>
      </section>
    </div>
  );
}
