import { Link } from "react-router";
import {
  LuArrowRight,
  LuArrowUpRight,
  LuBrainCircuit,
  LuCalendarDays,
  LuCheck,
  LuCloudUpload,
  LuFolderClock,
  LuLayers,
  LuMapPin,
  LuPlus,
  LuSatellite,
  LuScanLine,
} from "react-icons/lu";
import { useAuth } from "../../auth/hooks/useAuth";
import { useResource } from "../../../shared/api/useResource";
import {
  Page,
  Notice,
  StatusBadge,
  EmptyState,
} from "../../../shared/components/UI";
import { statusLabel } from "../utils/status";

export function Dashboard() {
  const { user } = useAuth();
  const analyses = useResource("analyses/?ordering=-created_at");
  const areas = useResource("study-areas/");
  const images = useResource("images/");

  const recentAnalyses = analyses.data?.results?.slice(0, 6) || [];
  const completedInPage = (analyses.data?.results || []).filter(
    (item) => item.status === "completed",
  ).length;
  const activeInPage = (analyses.data?.results || []).filter((item) =>
    ["queued", "running"].includes(item.status),
  ).length;

  const displayName =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    user?.username ||
    "Analista";
  const hasNoAnalyses = !analyses.loading && analyses.data?.count === 0;

  const stats = [
    {
      key: "areas",
      label: "Áreas de estudio",
      count: areas.data?.count ?? "—",
      note: "Territorios delimitados y activos en tu cuenta",
      cta: "Gestionar territorios",
      to: "/study-areas",
      icon: LuMapPin,
      accent: "emerald",
      query: areas,
    },
    {
      key: "images",
      label: "Imágenes satelitales",
      count: images.data?.count ?? "—",
      note: "Escenas Sentinel-2 GeoTIFF validadas en catálogo",
      cta: "Explorar catálogo",
      to: "/images",
      icon: LuSatellite,
      accent: "sky",
      query: images,
    },
    {
      key: "analyses",
      label: "Análisis registrados",
      count: analyses.data?.count ?? "—",
      note:
        activeInPage > 0
          ? `${activeInPage} en procesamiento · ${completedInPage} completados recientes`
          : "Estudios espectrales y comparaciones multitemporales",
      cta: "Ver historial",
      to: "/dashboard/history",
      icon: LuScanLine,
      accent: "lime",
      query: analyses,
    },
  ];

  const workflowSteps = [
    {
      step: "01",
      title: "Área de estudio",
      desc: "Selecciona o registra el territorio que deseas monitorear.",
      icon: LuMapPin,
    },
    {
      step: "02",
      title: "Ingesta GeoTIFF",
      desc: "Sube escenas Sentinel-2 con validación automática de bandas.",
      icon: LuCloudUpload,
    },
    {
      step: "03",
      title: "Serie temporal",
      desc: "Elige de 1 a 32 fechas ordenadas cronológicamente.",
      icon: LuLayers,
    },
    {
      step: "04",
      title: "Modelo ML activo",
      desc: "Obtén láminas PNG, métricas de cobertura y reporte PDF.",
      icon: LuBrainCircuit,
    },
  ];

  return (
    <Page title="ForestGuard · Panel de trabajo">
      {/* Saludo en texto claro fuera del recuadro */}
      <div className="fg-dash-user-greeting">
        <p className="fg-dash-user-greeting-name">
          Hola, <strong>{displayName}</strong>
        </p>
        <span className="fg-dash-user-greeting-sub">
          Panel de monitoreo e interpretación multitemporal Sentinel-2
        </span>
      </div>

      {/* Banner principal de acciones rápidas */}
      <section className="fg-dash-hero">
        <div className="fg-dash-hero-copy">
          <div className="fg-dash-hero-badges">
            <span className="fg-dash-model-pill">
              <LuCheck size={13} aria-hidden="true" />
              Motor ML v9 activo
            </span>
          </div>
          <h2>Tu territorio en perspectiva multitemporal</h2>
          <p>
            Registra escenas satelitales Sentinel-2, compara fechas y consulta
            índices de vegetación (NDVI, NDMI, NBR y NDRE) junto con reportes
            técnicos descargables desde un solo panel.
          </p>
        </div>

        <div className="fg-dash-hero-actions">
          <Link className="fg-dash-primary-cta" to="/dashboard/new">
            <LuPlus size={18} aria-hidden="true" />
            <span>Nuevo análisis</span>
          </Link>
          <div className="fg-dash-secondary-ctas">
            <Link className="fg-dash-secondary-cta" to="/study-areas">
              <LuMapPin size={15} aria-hidden="true" />
              <span>Áreas</span>
            </Link>
            <Link className="fg-dash-secondary-cta" to="/images">
              <LuSatellite size={15} aria-hidden="true" />
              <span>Imágenes</span>
            </Link>
            <Link className="fg-dash-secondary-cta" to="/dashboard/history">
              <LuFolderClock size={15} aria-hidden="true" />
              <span>Historial</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Tarjetas de métricas principales con acceso directo */}
      <section
        className="fg-dash-stats-grid"
        aria-label="Resumen general de recursos"
      >
        {stats.map((item) => {
          const Icon = item.icon;
          const isLoading = item.query.loading;
          return (
            <div
              key={item.key}
              aria-busy={isLoading}
              className={`fg-dash-stat-card is-${item.accent} ${isLoading ? "is-loading" : ""}`}
            >
              <div className="fg-dash-stat-top">
                <div className="min-w-0 flex-1">
                  <span className="fg-dash-stat-label">{item.label}</span>
                  <strong className="fg-dash-stat-value">
                    {isLoading ? (
                      <span
                        className="fg-skeleton fg-skeleton-stat-value"
                        role="status"
                        aria-label={`Cargando ${item.label}`}
                      />
                    ) : (
                      item.count
                    )}
                  </strong>
                </div>
                <div className="fg-dash-stat-icon" aria-hidden="true">
                  <Icon size={22} />
                </div>
              </div>

              <div className="fg-dash-stat-note">
                {isLoading ? (
                  <span
                    className="fg-skeleton fg-skeleton-stat-line"
                    aria-hidden="true"
                  />
                ) : (
                  item.note
                )}
              </div>

              <Notice error={item.query.error} />

              <Link to={item.to} className="fg-dash-stat-link">
                <span>{item.cta}</span>
                <LuArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          );
        })}
      </section>

      {/* Guía rápida del flujo de trabajo */}
      <section
        className="fg-dash-workflow"
        aria-label="Flujo de trabajo para realizar un estudio"
      >
        <div className="fg-dash-workflow-header">
          <div>
            <p className="fg-eyebrow">Guía rápida de operación</p>
            <h3>Cómo realizar un estudio satelital</h3>
          </div>
          <Link to="/help" className="fg-dash-help-link">
            <span>Ver guía completa</span>
            <LuArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </div>

        <ol className="fg-dash-workflow-grid">
          {workflowSteps.map((ws) => {
            const StepIcon = ws.icon;
            return (
              <li key={ws.step} className="fg-dash-workflow-item">
                <div className="fg-dash-workflow-top">
                  <span className="fg-dash-workflow-num">Paso {ws.step}</span>
                  <span className="fg-dash-workflow-icon" aria-hidden="true">
                    <StepIcon size={16} />
                  </span>
                </div>
                <strong>{ws.title}</strong>
                <p>{ws.desc}</p>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Actividad reciente */}
      <section className="space-y-4">
        <div className="fg-dash-recent-header">
          <div>
            <p className="fg-eyebrow">Actividad reciente</p>
            <h2>Análisis recientes</h2>
          </div>
          <Link
            to="/dashboard/history"
            aria-disabled={hasNoAnalyses || undefined}
            className={`fg-dash-history-btn ${hasNoAnalyses ? "is-empty" : ""}`}
          >
            <LuFolderClock size={16} aria-hidden="true" />
            <span>Ver historial completo</span>
            <LuArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>

        <Notice error={analyses.error} />

        {analyses.loading && (
          <div
            className="fg-dash-recent-grid"
            role="status"
            aria-label="Cargando análisis recientes"
          >
            {[1, 2, 3].map((placeholder) => (
              <div
                key={placeholder}
                className="fg-dash-recent-card is-skeleton"
                aria-hidden="true"
              >
                <div className="fg-dash-recent-top">
                  <span className="fg-skeleton fg-skeleton-pill" />
                  <span className="fg-skeleton fg-skeleton-icon" />
                </div>
                <div className="fg-dash-recent-body">
                  <span className="fg-skeleton fg-skeleton-title" />
                  <span className="fg-skeleton fg-skeleton-line" />
                </div>
                <div className="fg-dash-recent-meta">
                  <div className="fg-dash-recent-meta-row">
                    <span className="fg-skeleton fg-skeleton-chip" />
                    <span className="fg-skeleton fg-skeleton-chip" />
                  </div>
                  <span className="fg-skeleton fg-skeleton-box" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!analyses.loading && recentAnalyses.length > 0 && (
          <div className="fg-dash-recent-grid">
            {recentAnalyses.map((item) => {
              const dates = item.images.map((i) => i.date);
              const dateRange =
                dates.length === 0
                  ? "Sin fechas"
                  : dates.length === 1
                    ? dates[0]
                    : `${dates[0]} → ${dates[dates.length - 1]}`;

              return (
                <Link
                  key={item.id}
                  to={`/dashboard/results/${item.id}`}
                  className="fg-dash-recent-card"
                >
                  <div className="fg-dash-recent-top">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={item.status}>
                        {statusLabel(item.status)}
                      </StatusBadge>
                      <span className="fg-dash-recent-mode">
                        {item.images.length > 1 ? "Multitemporal" : "1 fecha"}
                      </span>
                    </div>
                    <span className="fg-dash-recent-open" aria-hidden="true">
                      <LuArrowUpRight size={17} />
                    </span>
                  </div>

                  <div className="fg-dash-recent-body">
                    <h3>{item.name}</h3>
                    {item.description && (
                      <p className="fg-dash-recent-desc">{item.description}</p>
                    )}
                  </div>

                  <div className="fg-dash-recent-meta">
                    <div className="fg-dash-recent-meta-row">
                      <span>
                        <LuSatellite size={13} aria-hidden="true" />
                        {item.images.length}{" "}
                        {item.images.length === 1 ? "escena" : "escenas"}
                      </span>
                      <span>
                        <LuCalendarDays size={13} aria-hidden="true" />
                        {new Date(item.created_at).toLocaleDateString("es-CO")}
                      </span>
                    </div>
                    <div
                      className="fg-dash-recent-dates"
                      title={dates.join(" → ")}
                    >
                      <strong> Cobertura:</strong> {dateRange}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {hasNoAnalyses && (
          <div className="fg-dash-empty-box">
            <EmptyState title="Tu próximo descubrimiento empieza aquí">
              Tu cuenta aún no tiene análisis. Empieza creando un área de
              estudio, cargando tus escenas Sentinel-2 GeoTIFF y ejecutando tu
              primer diagnóstico espectral o multitemporal.
            </EmptyState>
            <div className="fg-dash-empty-action">
              <Link className="fg-dash-primary-cta" to="/dashboard/new">
                <LuPlus size={18} aria-hidden="true" />
                <span>Crear nuevo análisis</span>
              </Link>
            </div>
          </div>
        )}
      </section>

      <p className="fg-dash-footnote">
        Los totales corresponden exclusivamente a los recursos de tu cuenta. No
        se suman superficies de fechas superpuestas.
      </p>
    </Page>
  );
}
