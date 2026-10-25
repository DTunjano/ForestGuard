import {
  LuBrainCircuit,
  LuCalendarDays,
  LuGitCompareArrows,
  LuInfo,
  LuLayers,
} from "react-icons/lu";
import { Panel } from "../../../shared/components/UI";

const number = (value) =>
  typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("es-CO", { maximumFractionDigits: 4 })
    : "No disponible";

const indexDescriptions = {
  NDVI: "Vigor y densidad de vegetación",
  NDMI: "Contenido de humedad en dosel",
  NBR: "Severidad espectral y estrés",
  NDRE: "Estado clorofílico (borde rojo)",
};

function Statistics({ values, isDelta = false }) {
  const entries = Object.entries(values || {});
  if (!entries.length) return null;

  return (
    <div className="fg-metrics-table-wrap">
      <table className="fg-metrics-table">
        <thead>
          <tr>
            <th>{isDelta ? "Diferencia (Δ)" : "Índice espectral"}</th>
            <th>Media</th>
            <th>p10 (10%)</th>
            <th>Mediana</th>
            <th>p90 (90%)</th>
            <th>Píxeles válidos</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([name, stats]) => {
            const cleanKey = name.replace(/^delta_/i, "").toUpperCase();
            const hint = indexDescriptions[cleanKey];
            return (
              <tr key={name}>
                <th>
                  <div className="fg-metrics-index-cell">
                    <span
                      className={`fg-metrics-index-badge ${isDelta ? "is-delta" : ""}`}
                    >
                      {name}
                    </span>
                    {hint && <small>{hint}</small>}
                  </div>
                </th>
                <td className="is-emphasis">{number(stats.media)}</td>
                <td>{number(stats.p10)}</td>
                <td className="is-emphasis">{number(stats.mediana)}</td>
                <td>{number(stats.p90)}</td>
                <td>{number(stats.pixeles_validos)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Metrics({ summary }) {
  const scenes = summary.escenas || [];
  const intervals = summary.intervalos || [];

  return (
    <div className="fg-metrics-stack">
      <div className="fg-metrics-guide">
        <span className="fg-metrics-guide-icon" aria-hidden="true">
          <LuInfo size={16} />
        </span>
        <p>
          <strong>Cómo leer esta tabla:</strong> el rango{" "}
          <strong>p10–p90</strong> abarca aproximadamente el 80 % central de los
          píxeles válidos de cada escena o intervalo. No es un intervalo de
          confianza estadística ni una medida de exactitud oficial.
        </p>
      </div>

      {scenes.length > 0 && (
        <div className="fg-metrics-section">
          <div className="fg-metrics-section-header">
            <span className="fg-metrics-section-icon" aria-hidden="true">
              <LuCalendarDays size={16} />
            </span>
            <div>
              <strong>Diagnóstico espectral por fecha</strong>
              <small>
                Valores de referencia calculados individualmente sobre cada
                escena satelital
              </small>
            </div>
          </div>

          <div className="space-y-4">
            {scenes.map((scene) => {
              const validPercent =
                typeof scene.fraccion_valida === "number"
                  ? scene.fraccion_valida * 100
                  : null;
              return (
                <Panel key={scene.fecha}>
                  <div className="fg-metric-scene-header">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="fg-metric-date-badge">
                        <LuCalendarDays size={14} aria-hidden="true" />
                        Escena individual
                      </span>
                      <h3 className="text-xl font-semibold">
                        Fecha {scene.fecha}
                      </h3>
                    </div>
                    {validPercent !== null && (
                      <span className="fg-metric-coverage-pill">
                        Cobertura útil: {number(validPercent)} %
                      </span>
                    )}
                  </div>

                  <div className="fg-metric-kpi-grid">
                    <div className="fg-metric-kpi-card">
                      <span>Área observada estimada</span>
                      <strong>
                        {number(scene.area_observada_ha_aprox)} ha
                      </strong>
                      <small>Superficie analizada libre de máscara</small>
                    </div>
                    <div className="fg-metric-kpi-card">
                      <span>Píxeles válidos / totales</span>
                      <strong>
                        {number(scene.pixeles_validos)} /{" "}
                        {number(scene.pixeles_totales)}
                      </strong>
                      <small>Píxeles aptos tras filtro radiométrico</small>
                    </div>
                    <div className="fg-metric-kpi-card is-highlight">
                      <span>Cobertura válida</span>
                      <strong>{number(validPercent)} %</strong>
                      <small>Proporción efectiva de observación</small>
                    </div>
                  </div>

                  <Statistics values={scene.indices} />
                </Panel>
              );
            })}
          </div>
        </div>
      )}

      {intervals.length > 0 && (
        <div className="fg-metrics-section">
          <div className="fg-metrics-section-header">
            <span
              className="fg-metrics-section-icon is-interval"
              aria-hidden="true"
            >
              <LuGitCompareArrows size={16} />
            </span>
            <div>
              <strong>Comparación multitemporal entre fechas</strong>
              <small>
                Diferencias espectrales (fecha final menos fecha inicial) e
                indicios exploratorios del modelo ML
              </small>
            </div>
          </div>

          <div className="space-y-4">
            {intervals.map((interval) => (
              <Panel key={`${interval.fecha_inicial}_${interval.fecha_final}`}>
                <div className="fg-metric-scene-header">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="fg-metric-interval-badge">
                      <LuGitCompareArrows size={14} aria-hidden="true" />
                      Intervalo de cambio
                    </span>
                    <h3 className="text-xl font-semibold">
                      {interval.fecha_inicial} → {interval.fecha_final}
                    </h3>
                  </div>
                  <span className="fg-metric-days-pill">
                    +{interval.dias} días entre tomas
                  </span>
                </div>

                <div className="fg-metric-kpi-grid fg-metric-kpi-grid-4">
                  <div className="fg-metric-kpi-card">
                    <span>Área común comparable</span>
                    <strong>{number(interval.area_comun_ha_aprox)} ha</strong>
                    <small>{interval.dias} días de separación temporal</small>
                  </div>
                  <div className="fg-metric-kpi-card">
                    <span>Píxeles comunes</span>
                    <strong>{number(interval.pixeles_comunes)}</strong>
                    <small>Intersección válida entre ambas fechas</small>
                  </div>
                  <div className="fg-metric-kpi-card is-warning">
                    <span>Área con indicios espectrales</span>
                    <strong>
                      {number(
                        interval.degradacion_observada
                          ?.area_con_indicios_ha_aprox,
                      )}{" "}
                      ha
                    </strong>
                    <small>Descenso espectral observado en el periodo</small>
                  </div>
                  <div className="fg-metric-kpi-card is-highlight">
                    <span>Superficie clase 1 exploratoria</span>
                    <strong>
                      {interval.superficie
                        ? `${number(interval.superficie.area_clase_1_ha_aprox)} ha`
                        : "No aplica"}
                    </strong>
                    <small>Estimación exploratoria del clasificador ML</small>
                  </div>
                </div>

                <Statistics values={interval.diferencias} isDelta />

                <div className="fg-metric-ml-box">
                  <div className="fg-metric-ml-header">
                    <span className="fg-metric-ml-icon" aria-hidden="true">
                      <LuBrainCircuit size={16} />
                    </span>
                    <div>
                      <p className="fg-metric-ml-status">
                        Clasificación:{" "}
                        {interval.estado_clasificacion || "No informada"}.{" "}
                        {interval.degradacion_observada?.interpretacion}
                      </p>
                      <small className="fg-metric-ml-legend">
                        <LuLayers size={12} aria-hidden="true" />
                        Cambios = fecha final menos inicial. En los mapas: rojo
                        indica descenso y azul indica aumento.
                      </small>
                    </div>
                  </div>
                  {interval.motivo_omision && (
                    <p className="fg-metric-ml-omission">
                      Motivo de omisión: {interval.motivo_omision}
                    </p>
                  )}
                </div>
              </Panel>
            ))}
          </div>
        </div>
      )}

      {!scenes.length && (
        <p>No se publicaron métricas de escenas para este análisis.</p>
      )}
    </div>
  );
}
