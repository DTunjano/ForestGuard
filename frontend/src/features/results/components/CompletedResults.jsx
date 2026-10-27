import { lazy, Suspense, useState } from "react";
import { LuDownload } from "react-icons/lu";
import { useResource } from "../../../shared/api/useResource";
import { download } from "../../../shared/api/client";
import {
  Button,
  Field,
  Notice,
  Panel,
  Select,
} from "../../../shared/components/UI";
import { Metrics } from "./Metrics";
import { ArtifactExplorer } from "./ArtifactExplorer";

const CoverageResults = lazy(() =>
  import("./CoverageResults").then((module) => ({
    default: module.CoverageResults,
  })),
);

export function CompletedResults({ id, summary }) {
  const query = useResource(`analyses/${id}/results/`);
  const [format, setFormat] = useState("both");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const artifacts = query.data
    ? ["reports", "individual", "comparisons", "other"].flatMap(
        (section) => query.data[section],
      )
    : [];
  async function exportAll() {
    if (busy) return;
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
      <Suspense fallback={<Notice>Cargando mapas de cobertura…</Notice>}>
        <CoverageResults summary={summary} artifacts={artifacts} />
      </Suspense>
      <Panel>
        <div className="fg-res-export-card">
          <div className="fg-res-export-info">
            <div>
              <p className="fg-eyebrow">Todos tus resultados</p>
              <h2 className="text-xl font-semibold">
                Descargar análisis completo
              </h2>
              <p className="fg-res-export-desc">
                Un ZIP con mapas, informe y métricas. Incluye todas las fechas y
                comparaciones.
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
      <Notice error={query.error}>
        {query.loading ? "Consultando archivos del análisis…" : null}
      </Notice>
      {query.error && (
        <Button onClick={query.reload}>Reintentar archivos</Button>
      )}
      {query.data && <ArtifactExplorer artifacts={artifacts} />}
    </div>
  );
}
