import { useState } from "react";
import { Link, useParams } from "react-router";
import { useResource } from "../../../shared/api/useResource";
import { download } from "../../../shared/api/client";
import {
  Page,
  Panel,
  Field,
  Select,
  Button,
  Notice,
} from "../../../shared/components/UI";
import { statusLabel } from "../../analyses/utils/status";
import { Metrics } from "../components/Metrics";
import { ArtifactCard } from "../components/ArtifactCard";
export function Results() {
  const { id } = useParams();
  const query = useResource(`analyses/${id}/`, { poll: true });
  return (
    <Page title={query.data?.name || "Resultados del análisis"}>
      <Link className="underline" to="/dashboard/history">
        Volver al historial
      </Link>
      <Notice error={query.error}>
        {query.loading ? "Consultando análisis…" : null}
      </Notice>
      {query.error && (
        <Button onClick={query.reload}>Reintentar consulta</Button>
      )}
      {query.data && (
        <>
          <Panel>
            <p role="status">Estado: {statusLabel(query.data.status)}</p>
            <p>
              Fechas: {query.data.images.map((image) => image.date).join(", ")}
            </p>
            {["queued", "running"].includes(query.data.status) && (
              <p>
                Consulta automática cada 5 segundos. Puedes salir y volver desde
                el historial. El backend no informa un porcentaje de
                procesamiento.
              </p>
            )}
            {query.data.status === "failed" && (
              <Notice
                error={
                  query.data.error_message ||
                  "El procesamiento falló. Revisa las imágenes y el worker."
                }
              />
            )}
          </Panel>
          {query.data.status === "completed" && (
            <CompletedResults key={id} id={id} summary={query.data.summary} />
          )}
        </>
      )}
    </Page>
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
    <>
      <Panel>
        <h2 className="text-xl">Resumen y métricas</h2>
        <p>
          Resultados exploratorios: valores bajos o descensos de índices no
          demuestran por sí solos deforestación. Las superficies de fechas e
          intervalos se presentan separadas y no deben sumarse.
        </p>
        <Metrics summary={summary || {}} />
      </Panel>
      <Panel>
        <h2 className="text-xl">Descargar análisis completo</h2>
        <Field label="Formato del paquete">
          <Select value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="both">PNG y GeoTIFF</option>
            <option value="png">PNG</option>
            <option value="tiff">GeoTIFF</option>
          </Select>
        </Field>
        <Button disabled={busy || !query.data} onClick={exportAll}>
          {busy ? "Preparando descarga…" : "Descargar ZIP completo"}
        </Button>
        <p>
          El paquete completo incluye las láminas disponibles y los informes.
          Los filtros de abajo afectan solo a la visualización.
        </p>
        <Notice error={error} />
      </Panel>
      <Panel>
        <h2 className="text-xl">Mapas e informes</h2>
        <p>
          Individual: ocre–verde o rojo–azul para valores bajos–altos.
          Comparación: rojo–azul para descenso–aumento. Las láminas incluyen
          escalas y estadísticas.
        </p>
        <div className="grid gap-3 md:grid-cols-3">
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
      {visible.map((artifact) => (
        <ArtifactCard key={artifact.id} artifact={artifact} />
      ))}
    </>
  );
}
