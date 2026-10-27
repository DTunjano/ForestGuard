import { useId, useState } from "react";
import { LuFileText, LuImage, LuLayers } from "react-icons/lu";
import {
  Button,
  EmptyState,
  Field,
  Panel,
  Select,
} from "../../../shared/components/UI";
import { ArtifactCard } from "./ArtifactCard";
import {
  describeArtifact,
  filterArtifacts,
  explorationArtifacts,
  paletteVariants,
} from "../utils/artifactCatalog";
import "./artifact-explorer.css";

const categories = [
  ["all", "Todos"],
  ["overview", "Resúmenes"],
  ["individual", "Por fecha"],
  ["comparisons", "Comparaciones"],
  ["reports", "Informes"],
  ["other", "Otros"],
];
const PAGE_SIZE = 6;

export function ArtifactExplorer({ artifacts, purpose = "technical" }) {
  const exploring = purpose === "exploration";
  const items = (exploring ? explorationArtifacts(artifacts) : artifacts).map(
    describeArtifact,
  );
  const [category, setCategory] = useState(
    items.some((item) => item.category === "overview") ? "overview" : "all",
  );
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("");
  const [format, setFormat] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [palette, setPalette] = useState("default");
  const viewerId = useId();
  const filtered = filterArtifacts(items, { category, search, period, format });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const offset = (currentPage - 1) * PAGE_SIZE;
  const visible = filtered.slice(offset, offset + PAGE_SIZE);
  const active = visible.find((item) => item.id === selected) || visible[0];
  const variants = active ? paletteVariants(active, artifacts) : [];
  const alternate = variants.find((item) =>
    item.relative_path.includes("_contraste."),
  );
  const displayed =
    palette === "contrast" && alternate ? describeArtifact(alternate) : active;
  const periods = [
    ...new Set(
      items
        .filter((item) => category === "all" || item.category === category)
        .map((item) => item.period)
        .filter(Boolean),
    ),
  ];
  function reset() {
    setCategory("all");
    setSearch("");
    setPeriod("");
    setFormat("");
    setPage(1);
    setSelected(null);
  }

  return (
    <section
      id="res-explorer"
      aria-label={exploring ? "Mapas de índices" : "Archivos del análisis"}
    >
      <Panel>
        <div className="fg-files-heading">
          <div>
            <p className="fg-eyebrow">
              {exploring ? "Exploración visual" : "Biblioteca técnica"}
            </p>
            <h2>{exploring ? "Mapas de índices" : "Archivos del análisis"}</h2>
            <p>
              {exploring
                ? "Explora la vegetación, humedad y diferencias entre fechas. Los índices conservan su escala propia."
                : "GeoTIFF para herramientas geográficas, JSON con métricas y todos los archivos originales del análisis."}
            </p>
          </div>
          <span className="fg-files-count">{items.length} archivos</span>
        </div>
        <div
          className="fg-files-categories"
          role="group"
          aria-label="Tipos de resultados"
        >
          {categories
            .filter(
              ([key]) =>
                key === "all" || items.some((item) => item.category === key),
            )
            .map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={category === key}
                onClick={() => {
                  setCategory(key);
                  setPeriod("");
                  setFormat("");
                  setSearch("");
                  setPage(1);
                  setSelected(null);
                }}
              >
                {label}
                <span>
                  {key === "all"
                    ? items.length
                    : items.filter((item) => item.category === key).length}
                </span>
              </button>
            ))}
        </div>
        <div className="fg-files-filters">
          <Field
            label="Buscar archivos"
            value={search}
            placeholder="Nombre, índice o fecha"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          <Field label="Fecha o intervalo del archivo">
            <Select
              value={period}
              onChange={(event) => {
                setPeriod(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Todas las fechas</option>
              {periods.map((value) => (
                <option key={value} value={value}>
                  {value.replace("_", " a ")}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Formato disponible">
            <Select
              value={format}
              onChange={(event) => {
                setFormat(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos los formatos</option>
              <option value="png">PNG</option>
              <option value="tiff">GeoTIFF + PNG</option>
              <option value="pdf">PDF</option>
              <option value="json">JSON</option>
            </Select>
          </Field>
        </div>
        <div className="fg-files-status">
          <p role="status">
            {filtered.length
              ? `Archivos ${offset + 1}–${offset + visible.length} de ${filtered.length}`
              : "Sin coincidencias"}
          </p>
          {(category !== "all" || search || period || format) && (
            <button type="button" onClick={reset}>
              Mostrar todos los archivos
            </button>
          )}
        </div>
        {active ? (
          <div className="fg-files-workspace">
            <div className="fg-files-navigation">
              <ul aria-label="Lista de archivos" className="fg-files-list">
                {visible.map((item) => {
                  const Icon =
                    item.kind === "raster"
                      ? LuLayers
                      : item.format === "png"
                        ? LuImage
                        : LuFileText;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        aria-pressed={active.id === item.id}
                        aria-controls={viewerId}
                        aria-label={`Seleccionar ${item.title} · ${item.periodLabel} · ${item.format.toUpperCase()}`}
                        onClick={() => setSelected(item.id)}
                      >
                        <Icon aria-hidden="true" />
                        <span className="min-w-0">
                          <strong>{item.title}</strong>
                          <small>{item.periodLabel}</small>
                        </span>
                        <span className="fg-file-format">
                          {item.format === "tiff"
                            ? "TIFF + PNG"
                            : item.format.toUpperCase()}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="fg-files-pagination">
                <Button
                  variant="secondary"
                  disabled={currentPage === 1}
                  onClick={() => {
                    setPage(currentPage - 1);
                    setSelected(null);
                  }}
                >
                  Archivos anteriores
                </Button>
                <span>
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="secondary"
                  disabled={currentPage === totalPages}
                  onClick={() => {
                    setPage(currentPage + 1);
                    setSelected(null);
                  }}
                >
                  Archivos siguientes
                </Button>
              </div>
            </div>
            <section
              id={viewerId}
              className="fg-files-preview"
              aria-label="Vista del archivo seleccionado"
            >
              <p className="fg-files-period">{active.periodLabel}</p>
              {exploring && alternate && variants.length > 1 && (
                <Field label="Paleta del mapa">
                  <Select
                    value={palette}
                    onChange={(event) => setPalette(event.target.value)}
                  >
                    <option value="default">Ocre–verde</option>
                    <option value="contrast">Rojo–azul · contraste</option>
                  </Select>
                </Field>
              )}
              <ArtifactCard
                key={displayed.id}
                artifact={displayed}
                title={displayed.title}
                initialOpen
                showToggle={false}
                stablePreview
              />
            </section>
          </div>
        ) : (
          <EmptyState
            title="No hay archivos con esos filtros"
            action={<Button onClick={reset}>Restablecer búsqueda</Button>}
          >
            Prueba otro nombre, fecha o formato.
          </EmptyState>
        )}
      </Panel>
    </section>
  );
}
