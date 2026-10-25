import { useState } from "react";
import { Link } from "react-router";
import {
  LuActivity,
  LuArrowLeft,
  LuArrowRight,
  LuBrainCircuit,
  LuCheck,
  LuCpu,
  LuFileCheck2,
  LuLayers,
  LuPlus,
  LuSatellite,
  LuShieldCheck,
  LuSlidersHorizontal,
  LuSparkles,
} from "react-icons/lu";
import { useResource } from "../../../shared/api/useResource";
import { Page, Notice, EmptyState } from "../../../shared/components/UI";

function formatMetric(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toFixed(3);
}

function computeOverallEvaluation(zones) {
  if (!Array.isArray(zones) || zones.length === 0) return null;

  const totals = zones.reduce(
    (acc, z) => ({
      rows: acc.rows + Number(z.filas_evaluacion || 0),
      positives: acc.positives + Number(z.positivos_evaluacion || 0),
      tp: acc.tp + Number(z.TP || 0),
      fp: acc.fp + Number(z.FP || 0),
      fn: acc.fn + Number(z.FN || 0),
      tn: acc.tn + Number(z.TN || 0),
    }),
    { rows: 0, positives: 0, tp: 0, fp: 0, fn: 0, tn: 0 },
  );

  const precision =
    totals.tp + totals.fp > 0 ? totals.tp / (totals.tp + totals.fp) : null;
  const recall =
    totals.tp + totals.fn > 0 ? totals.tp / (totals.tp + totals.fn) : null;
  const f1 =
    precision !== null && recall !== null && precision + recall > 0
      ? (2 * precision * recall) / (precision + recall)
      : null;
  const specificity =
    totals.tn + totals.fp > 0 ? totals.tn / (totals.tn + totals.fp) : null;
  const balancedAccuracy =
    recall !== null && specificity !== null ? (recall + specificity) / 2 : null;

  return {
    ...totals,
    precision,
    recall,
    f1,
    balancedAccuracy,
  };
}

export function Models() {
  const [page, setPage] = useState(1);
  const query = useResource(`models/?page=${page}`);
  const models = query.data?.results || [];

  return (
    <Page
      title="Modelos disponibles"
      description="Consulta la arquitectura, los insumos espectrales, los índices biofísicos y el alcance metodológico del motor de clasificación activo en ForestGuard."
      action={
        <Link className="fg-dash-primary-cta" to="/dashboard/new">
          <LuPlus size={17} aria-hidden="true" />
          <span>Crear análisis</span>
        </Link>
      }
    >
      <Notice error={query.error} />

      {query.loading && models.length === 0 && (
        <div
          className="fg-model-showcase"
          role="status"
          aria-label="Cargando modelos disponibles"
        >
          <div className="fg-model-hero">
            <span className="fg-skeleton fg-skeleton-icon" />
            <div className="space-y-3 flex-1">
              <span className="fg-skeleton fg-skeleton-pill" />
              <span className="fg-skeleton fg-skeleton-title" />
              <span className="fg-skeleton fg-skeleton-line" />
            </div>
          </div>
          <div className="fg-model-highlights-grid">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="fg-model-highlight-card">
                <span className="fg-skeleton fg-skeleton-chip" />
                <span className="fg-skeleton fg-skeleton-title" />
                <span className="fg-skeleton fg-skeleton-line" />
              </div>
            ))}
          </div>
        </div>
      )}

      {models.map((model) => {
        const profile = model.performance_profile || {};
        const threshold = profile.umbral_operativo_exploratorio ?? 0.5;
        const zoneValidation = Array.isArray(
          profile.validacion_dejando_una_zona_fuera,
        )
          ? profile.validacion_dejando_una_zona_fuera
          : [];
        const overallEval = computeOverallEvaluation(zoneValidation);

        const highlights = [
          {
            key: "algorithm",
            icon: LuCpu,
            label: "Algoritmo principal",
            value: model.algorithm || "Random Forest",
            desc: "Clasificador supervisado entrenado sobre cambios multitemporales de reflectancia e índices espectrales.",
            accent: "lime",
          },
          {
            key: "bands",
            icon: LuSatellite,
            label: "Bandas Sentinel-2",
            value: "7 espectrales + SCL",
            desc: "Requiere B2, B3, B4, B5, B8, B11, B12 y máscara SCL (clases válidas 4 de vegetación y 5 de suelo).",
            accent: "sky",
          },
          {
            key: "indices",
            icon: LuLayers,
            label: "Índices integrados",
            value: "NDVI · NDMI · NBR · NDRE",
            desc: "Combina vigor fotosintético, humedad del dosel, severidad de alteración y borde rojo en cada par de fechas.",
            accent: "emerald",
          },
          {
            key: "threshold",
            icon: LuSlidersHorizontal,
            label: "Umbral operativo",
            value: `Puntaje ≥ ${threshold}`,
            desc:
              profile.interpretacion_puntaje ||
              "Puntaje relativo de cambio histórico (predict_proba), no calibrado como porcentaje de certeza individual.",
            accent: "amber",
          },
        ];

        return (
          <article key={model.id} className="fg-model-showcase">
            {/* Banner principal del modelo */}
            <header className="fg-model-hero">
              <div className="fg-model-hero-icon" aria-hidden="true">
                <LuBrainCircuit size={30} />
              </div>

              <div className="fg-model-hero-body">
                <div className="fg-model-hero-badges">
                  <span className="fg-status fg-status-completed">
                    <span aria-hidden="true" />
                    Modelo activo
                  </span>
                  <span className="fg-model-tag">Versión {model.version}</span>
                  <span className="fg-model-tag is-sky">{model.algorithm}</span>
                  <span className="fg-model-tag">Pipeline histórico v7</span>
                </div>

                <h2>
                  {model.name} · {model.version}
                </h2>

                <p className="fg-model-hero-desc">
                  {model.description} Permite analizar una imagen o varias
                  escenas satelitales Sentinel-2 para detectar patrones de
                  deforestación (cambio histórico de cobertura) e indicios
                  espectrales de degradación vegetal sobre el área de estudio.
                </p>
              </div>
            </header>

            {/* Tarjetas con las 4 características principales del modelo */}
            <section
              className="space-y-3"
              aria-label="Características principales del modelo"
            >
              <div className="fg-model-section-head">
                <span className="fg-eyebrow">
                  <LuSparkles aria-hidden="true" /> Especificaciones clave
                </span>
                <h3>Características principales del modelo</h3>
              </div>

              <div className="fg-model-highlights-grid">
                {highlights.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.key}
                      className={`fg-model-highlight-card is-${item.accent}`}
                    >
                      <div className="fg-model-highlight-top">
                        <span>{item.label}</span>
                        <div
                          className="fg-model-highlight-icon"
                          aria-hidden="true"
                        >
                          <Icon size={17} />
                        </div>
                      </div>
                      <strong>{item.value}</strong>
                      <p>{item.desc}</p>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Dos columnas: Capacidades operativas y Alcance metodológico */}
            <div className="fg-model-details-cols">
              <section className="fg-model-detail-box">
                <div className="fg-model-detail-box-head">
                  <span className="fg-model-detail-icon" aria-hidden="true">
                    <LuFileCheck2 size={18} />
                  </span>
                  <div>
                    <span className="fg-eyebrow">Operación en plataforma</span>
                    <h3>Qué produce en cada análisis</h3>
                  </div>
                </div>

                <ul className="fg-model-feature-list">
                  <li>
                    <LuCheck size={15} aria-hidden="true" />
                    <div>
                      <strong>
                        Análisis individual, bitemporal y series en cadena
                      </strong>
                      <p>
                        Procesa desde 1 hasta 32 escenas ordenadas
                        cronológicamente, evaluando diagnósticos por escena,
                        intervalos consecutivos (`N-1`) y la comparación
                        envolvente entre la primera y la última fecha.
                      </p>
                    </div>
                  </li>
                  <li>
                    <LuCheck size={15} aria-hidden="true" />
                    <div>
                      <strong>Separación de coberturas e indicios</strong>
                      <p>
                        Distingue cobertura vegetal estable, cambio histórico de
                        cobertura (modelo v9), indicios espectrales de
                        degradación sujetos a revisión y exclusiones por máscara
                        SCL.
                      </p>
                    </div>
                  </li>
                  <li>
                    <LuCheck size={15} aria-hidden="true" />
                    <div>
                      <strong>Artefactos técnicos descargables</strong>
                      <p>
                        Genera láminas visuales PNG, raster clasificado GeoTIFF,
                        métricas estructuradas JSON, reporte ejecutivo PDF y
                        paquete completo ZIP.
                      </p>
                    </div>
                  </li>
                </ul>
              </section>

              <section className="fg-model-detail-box">
                <div className="fg-model-detail-box-head">
                  <span
                    className="fg-model-detail-icon is-sky"
                    aria-hidden="true"
                  >
                    <LuShieldCheck size={18} />
                  </span>
                  <div>
                    <span className="fg-eyebrow">Gobernanza y dominio</span>
                    <h3>Alcance metodológico y seguridad</h3>
                  </div>
                </div>

                <ul className="fg-model-feature-list">
                  <li>
                    <LuCheck size={15} aria-hidden="true" />
                    <div>
                      <strong>Enfoque estrictamente histórico</strong>
                      <p>
                        El modelo no predice riesgo futuro ni emite alertas
                        oficiales; cuantifica diferencias espectrales observadas
                        entre fechas registradas.
                      </p>
                    </div>
                  </li>
                  <li>
                    <LuCheck size={15} aria-hidden="true" />
                    <div>
                      <strong>
                        Normalización radiométrica y filtrado de nubes
                      </strong>
                      <p>
                        Infiere automáticamente la escala de reflectancia
                        (`fracción` o `10 000`) y aplica la banda `SCL` para
                        evaluar píxeles limpios de vegetación (`clase 4`) y
                        suelo (`clase 5`), excluyendo nubes, sombras y agua.
                      </p>
                    </div>
                  </li>
                  <li>
                    <LuCheck size={15} aria-hidden="true" />
                    <div>
                      <strong>Artefacto verificado en servidor</strong>
                      <p>
                        El clasificador `modelo_exploratorio.joblib` se valida y
                        ejecuta localmente dentro del motor
                        `forestguard_pipeline_historico_v7`, bloqueando la carga
                        de modelos externos desde peticiones de clientes.
                      </p>
                    </div>
                  </li>
                </ul>
              </section>
            </div>

            {/* Tarjetas de evaluación general del modelo de ML */}
            {overallEval && (
              <section
                className="space-y-3"
                aria-label="Evaluación general del modelo de ML"
              >
                <div className="fg-model-validation-head">
                  <div className="fg-model-section-head">
                    <span className="fg-eyebrow">
                      <LuActivity aria-hidden="true" /> Desempeño global del
                      clasificador
                    </span>
                    <h3>Evaluación del modelo de ML</h3>
                  </div>
                  <span className="fg-model-validation-note">
                    Métricas generales sobre{" "}
                    {overallEval.rows.toLocaleString("es-CO")} píxeles evaluados
                    (escala 0–1)
                  </span>
                </div>

                <div className="fg-model-highlights-grid">
                  {[
                    {
                      key: "precision",
                      icon: LuShieldCheck,
                      label: "Precisión",
                      value: formatMetric(overallEval.precision),
                      desc: "Proporción de detecciones positivas que corresponden efectivamente a cambio histórico validado.",
                      accent: "lime",
                    },
                    {
                      key: "recall",
                      icon: LuActivity,
                      label: "Recall",
                      value: formatMetric(overallEval.recall),
                      desc: "Sensibilidad del modelo para captar los eventos reales de pérdida de cobertura en las muestras evaluadas.",
                      accent: "sky",
                    },
                    {
                      key: "f1",
                      icon: LuLayers,
                      label: "Puntaje F1",
                      value: formatMetric(overallEval.f1),
                      desc: "Media armónica que equilibra la precisión y el recall del clasificador sobre la clase de cambio.",
                      accent: "emerald",
                    },
                    {
                      key: "balancedAccuracy",
                      icon: LuSparkles,
                      label: "Exactitud balanceada",
                      value: formatMetric(overallEval.balancedAccuracy),
                      desc: "Promedio entre sensibilidad y especificidad que compensa el desbalance entre cobertura estable y cambio.",
                      accent: "amber",
                    },
                  ].map((metric) => {
                    const MetricIcon = metric.icon;
                    return (
                      <div
                        key={metric.key}
                        className={`fg-model-highlight-card is-${metric.accent}`}
                      >
                        <div className="fg-model-highlight-top">
                          <span>{metric.label}</span>
                          <div
                            className="fg-model-highlight-icon"
                            aria-hidden="true"
                          >
                            <MetricIcon size={17} />
                          </div>
                        </div>
                        <strong>{metric.value}</strong>
                        <p>{metric.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </article>
        );
      })}

      {!query.loading && models.length === 0 && (
        <EmptyState title="No hay modelos activos registrados">
          Puedes continuar generando diagnósticos de índices espectrales (NDVI,
          NDMI, NBR y NDRE) con una o varias escenas.
        </EmptyState>
      )}

      {(query.data?.previous || query.data?.next) && (
        <div className="fg-subtle-pagination rounded-xl border border-white/10">
          <span className="fg-subtle-pagination-range">
            Página <strong>{page}</strong>
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
      )}
    </Page>
  );
}
