import { lazy, Suspense, useId, useState } from "react";
import { LuDownload } from "react-icons/lu";
import { useResource } from "../../../shared/api/useResource";
import { download } from "../../../shared/api/client";
import { useAuth } from "../../auth/hooks/useAuth";
import {
  Button,
  Field,
  Notice,
  Panel,
  Select,
} from "../../../shared/components/UI";
import { Metrics } from "./Metrics";
import { ArtifactExplorer } from "./ArtifactExplorer";
import { ResultDownload } from "./ResultDownload";
import "./artifact-explorer.css";

const CoverageResults = lazy(() =>
  import("./CoverageResults").then((module) => ({
    default: module.CoverageResults,
  })),
);
const V9Evaluation = lazy(() =>
  import("./V9Evaluation").then((module) => ({ default: module.V9Evaluation })),
);
const sections = [
  ["summary", "Resumen", "Mapas, porcentajes e informe"],
  ["exploration", "Explorar índices", "Vegetación, humedad y cambios"],
  ["technical", "Descargas técnicas", "GeoTIFF, métricas y paquete completo"],
];

export function CompletedResults({ id, summary }) {
  const { can } = useAuth();
  const query = useResource(`analyses/${id}/results/`);
  const [section, setSection] = useState("summary");
  const [format, setFormat] = useState("both");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const contentId = useId();
  const artifacts = query.data
    ? ["reports", "individual", "comparisons", "other"].flatMap(
        (key) => query.data[key] || [],
      )
    : [];
  const report = artifacts.find((item) =>
    item.relative_path.toLowerCase().endsWith(".pdf"),
  );
  const predictions = artifacts
    .filter((item) => item.v9_evaluation_url)
    .sort((first, last) =>
      first.relative_path.localeCompare(last.relative_path),
    );
  const levels = predictions.length
    ? [
        ...sections,
        ["evaluation", "Evaluación v9", "Comparar con una referencia"],
      ]
    : sections;
  async function exportAll() {
    if (busy || !query.data) return;
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
      <div
        className={`fg-results-levels${predictions.length ? " has-evaluation" : ""}`}
        role="group"
        aria-label="Nivel de detalle de resultados"
      >
        {levels.map(([key, label, description]) => (
          <button
            key={key}
            type="button"
            aria-pressed={section === key}
            aria-controls={contentId}
            onClick={() => setSection(key)}
          >
            <strong>{label}</strong>
            <span>{description}</span>
          </button>
        ))}
      </div>
      <Notice error={query.error}>
        {query.loading ? "Consultando archivos del análisis…" : null}
      </Notice>
      {query.error && (
        <Button onClick={query.reload}>Reintentar archivos</Button>
      )}
      <div id={contentId}>
        {section === "evaluation" && predictions.length > 0 && (
          <Suspense fallback={<Notice>Cargando evaluación v9…</Notice>}>
            <V9Evaluation
              predictions={predictions}
              canEvaluate={can("analyses.add_analysis")}
            />
          </Suspense>
        )}
        <div hidden={section !== "summary"} className="fg-res-completed-stack">
          <Suspense fallback={<Notice>Cargando mapas de cobertura…</Notice>}>
            <CoverageResults summary={summary || {}} artifacts={artifacts} />
          </Suspense>
          <Panel>
            <div className="fg-results-primary-download">
              <div>
                <h2 className="text-xl font-semibold">
                  Tu informe de resultados
                </h2>
                <p>
                  Un documento con mapas, porcentajes e interpretación de todas
                  las fechas y comparaciones.
                </p>
              </div>
              <ResultDownload artifact={report}>
                Descargar informe PDF
              </ResultDownload>
            </div>
            {!query.loading && !query.error && !report && (
              <p>
                Este análisis no incluye un informe PDF. Sus archivos
                disponibles están en Descargas técnicas.
              </p>
            )}
          </Panel>
        </div>
        {section === "exploration" && (
          <div className="fg-res-completed-stack">
            {query.data && (
              <ArtifactExplorer artifacts={artifacts} purpose="exploration" />
            )}
            <Panel>
              <details className="fg-results-metrics">
                <summary>
                  <h2>Resumen y métricas</h2>
                  <span className="fg-when-closed">Ver estadísticas</span>
                  <span className="fg-when-open">Ocultar estadísticas</span>
                </summary>
                <Metrics summary={summary || {}} />
              </details>
            </Panel>
          </div>
        )}
        {section === "technical" && (
          <div className="fg-res-completed-stack">
            <Panel>
              <div className="fg-res-export-card">
                <div className="fg-res-export-info">
                  <div>
                    <p className="fg-eyebrow">Todos tus resultados</p>
                    <h2 className="text-xl font-semibold">
                      Descargar análisis completo
                    </h2>
                    <p className="fg-res-export-desc">
                      El ZIP conserva todas las fechas, comparaciones y
                      archivos, independientemente de los filtros de pantalla.
                    </p>
                  </div>
                </div>
                <div className="fg-res-export-controls">
                  <Field label="Formato del paquete">
                    <Select
                      value={format}
                      onChange={(event) => setFormat(event.target.value)}
                    >
                      <option value="both">PNG y GeoTIFF</option>
                      <option value="png">PNG</option>
                      <option value="tiff">GeoTIFF</option>
                    </Select>
                  </Field>
                  <Button disabled={busy || !query.data} onClick={exportAll}>
                    <LuDownload aria-hidden="true" />
                    {busy ? "Preparando descarga…" : "Descargar ZIP completo"}
                  </Button>
                </div>
              </div>
              <Notice error={error} />
            </Panel>
            {query.data && <ArtifactExplorer artifacts={artifacts} />}
          </div>
        )}
      </div>
    </div>
  );
}
