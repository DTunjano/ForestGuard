import { lazy, Suspense, useId, useState } from "react";
import {
  Button,
  Field,
  Notice,
  Panel,
  Select,
} from "../../../shared/components/UI";
import { PrivateImage } from "./ArtifactCard";
import { INDEX_LAYERS } from "../utils/mapLayers";
import "./coverage-map.css";

const InteractiveCoverageMap = lazy(() =>
  import("./InteractiveCoverageMap").then((module) => ({
    default: module.InteractiveCoverageMap,
  })),
);

const percent = (value) =>
  value == null
    ? "Sin área válida"
    : `${value.toLocaleString("es-CO", { maximumFractionDigits: 2 })} %`;

export function CoverageResults({ summary, artifacts }) {
  const [selected, setSelected] = useState("");
  const entries = [
    ...(summary.escenas || []).map((scene) => ({
      ...scene,
      title: `Condición individual · ${scene.fecha}`,
      folder: `fechas/${scene.fecha}`,
      original: `fechas/${scene.fecha}/original_rgb.png`,
    })),
    ...(summary.intervalos || []).map((interval) => ({
      ...interval,
      title: `Comparación · ${interval.fecha_inicial} a ${interval.fecha_final}`,
      folder: `intervalos/${interval.fecha_inicial}_${interval.fecha_final}`,
      original: `intervalos/${interval.fecha_inicial}_${interval.fecha_final}/original_final_rgb.png`,
    })),
  ].filter((item) => item.condicion);
  if (!entries.length)
    return (
      <Panel>
        <p>
          Este análisis conserva sus resultados originales. Un nuevo
          procesamiento incluirá el mapa de categorías y porcentajes de
          cobertura.
        </p>
      </Panel>
    );
  const entry =
    entries.find((item) => item.folder === selected) || entries.at(-1);
  const condition = entry.condicion;
  return (
    <section
      className="fg-coverage-results"
      aria-label="Original y resultado de cobertura"
    >
      <Panel>
        <div className="fg-coverage-header flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="fg-eyebrow">Lectura de la cobertura</p>
            <h2 className="text-xl font-semibold">
              Imagen original y resultado
            </h2>
          </div>
          <Field label="Fecha o comparación">
            <Select
              value={entry.folder}
              onChange={(event) => setSelected(event.target.value)}
            >
              {entries.map((item) => (
                <option key={item.folder} value={item.folder}>
                  {item.title}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <CoverageExplorer
          key={entry.folder}
          entry={entry}
          condition={condition}
          artifacts={artifacts}
        />
      </Panel>
    </section>
  );
}

function CoverageExplorer({ entry, condition, artifacts }) {
  const [selected, setSelected] = useState([]);
  const [opacity, setOpacity] = useState(20);
  const [layerId, setLayerId] = useState("categories");
  const helpId = useId();
  const original = artifacts.find(
    (artifact) => artifact.relative_path === entry.original,
  );
  const result = artifacts.find(
    (artifact) =>
      artifact.relative_path === `${entry.folder}/condicion_bosque.tif`,
  );
  const layers = INDEX_LAYERS.map((index) => ({
    ...index,
    artifact: artifacts.find(
      (artifact) =>
        artifact.relative_path ===
        `${entry.folder}/${condition.tipo === "temporal" ? "d" : ""}${index.id}.tif`,
    ),
  })).filter((index) => index.artifact);
  const layer = layers.find((item) => item.id === layerId);
  const selectedCategories = condition.categorias.filter((item) =>
    selected.includes(item.valor),
  );
  const filterAvailable = !!result?.category_mask_url;
  function toggle(value) {
    setSelected((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  }
  return (
    <>
      {filterAvailable && (
        <div className="fg-map-controls">
          <Field label="Capa del mapa">
            <Select
              value={layerId}
              onChange={(event) => setLayerId(event.target.value)}
            >
              <option value="categories">Categorías de cobertura</option>
              {layers.map((index) => (
                <option key={index.id} value={index.id}>
                  {condition.tipo === "temporal" ? "Cambio " : ""}
                  {index.id} · {index.bands}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={`Visibilidad del resto: ${opacity} %`}>
            <input
              type="range"
              min="0"
              max="70"
              step="5"
              value={opacity}
              disabled={!selected.length}
              aria-describedby={helpId}
              onChange={(event) => setOpacity(Number(event.target.value))}
            />
          </Field>
          <Button
            variant="secondary"
            disabled={
              !selected.length && layerId === "categories" && opacity === 20
            }
            onClick={() => {
              setSelected([]);
              setLayerId("categories");
              setOpacity(20);
            }}
          >
            Mostrar todo
          </Button>
          <p
            id={helpId}
            className="text-sm text-slate-300 fg-map-controls-help"
          >
            Selecciona una o varias tarjetas para resaltar sus zonas. Con 0 % se
            oculta el resto; los porcentajes y hectáreas se conservan.
          </p>
        </div>
      )}
      {layer && (
        <p className="text-sm text-slate-300">
          {layer.description} · Bandas {layer.bands}.
          {condition.tipo === "temporal"
            ? " El mapa muestra la diferencia entre la fecha final y la inicial."
            : " El mapa muestra valores de esta fecha."}
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <figure className="min-w-0 space-y-2">
          <figcaption className="font-semibold">
            Imagen original{" "}
            {condition.tipo === "temporal"
              ? "· fecha final"
              : "· color natural"}
          </figcaption>
          {original ? (
            <PrivateImage
              url={original.download_url}
              label={`Original ${entry.title}`}
            />
          ) : (
            <p>Original no disponible.</p>
          )}
        </figure>
        <figure className="min-w-0 space-y-2">
          <figcaption className="font-semibold">
            Resultado ·{" "}
            {layer
              ? `${condition.tipo === "temporal" ? "Cambio " : ""}${layer.id}`
              : "categorías espectrales"}
          </figcaption>
          {filterAvailable ? (
            <Suspense fallback={<Notice>Cargando visor…</Notice>}>
              <InteractiveCoverageMap
                result={result}
                layer={layer?.artifact}
                categories={condition.categorias}
                selected={selected}
                contextOpacity={opacity}
                title={`Mapa interactivo ${layer?.id || "de cobertura"} · ${entry.title}`}
                filename={`${entry.folder.replaceAll("/", "_")}_${layer?.id || "cobertura"}`}
              />
            </Suspense>
          ) : result ? (
            <PrivateImage
              url={result.png_download_url || result.preview_url}
              label={`Mapa de cobertura ${entry.title}`}
            />
          ) : (
            <p>Mapa no disponible.</p>
          )}
        </figure>
      </div>
      <div
        role="group"
        aria-label="Resaltar categorías de cobertura"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {condition.categorias.map((category) => (
          <button
            key={category.clave}
            type="button"
            className="fg-coverage-toggle"
            disabled={!filterAvailable || category.porcentaje == null}
            aria-pressed={selected.includes(category.valor)}
            aria-label={`Resaltar ${category.etiqueta}`}
            onClick={() => toggle(category.valor)}
          >
            <span className="flex items-start gap-2 text-sm">
              <span
                aria-hidden="true"
                className="mt-1 h-3 w-3 shrink-0 rounded-full"
                style={{ background: category.color }}
              />
              {category.clave === "degradacion" && condition.tipo !== "temporal"
                ? "Degradación"
                : category.etiqueta}
            </span>
            <span className="mt-3 block text-xl font-semibold">
              {category.clave === "degradacion" && condition.tipo !== "temporal"
                ? "Requiere otra fecha"
                : percent(category.porcentaje)}
            </span>
            {category.area_ha != null && (
              <span className="mt-1 block text-sm text-slate-400">
                {category.area_ha.toLocaleString("es-CO", {
                  maximumFractionDigits: 2,
                })}{" "}
                ha
              </span>
            )}
            {filterAvailable && category.porcentaje != null && (
              <span className="mt-3 block text-xs text-slate-300">
                {selected.includes(category.valor)
                  ? "✓ Resaltada"
                  : "Resaltar zona"}
              </span>
            )}
          </button>
        ))}
      </div>
      {filterAvailable && (
        <p role="status" className="text-sm text-slate-300">
          {selected.length
            ? `Resaltando: ${selectedCategories.map((item) => item.etiqueta).join(", ")}.`
            : "Mostrando todas las categorías."}
          {selected.length > 0 &&
          selectedCategories.every((item) => item.pixeles === 0)
            ? " No hay píxeles de estas categorías en el periodo seleccionado."
            : ""}
        </p>
      )}
      <p className="text-sm text-slate-300">
        Cobertura válida:{" "}
        <strong>{percent(condition.porcentaje_cobertura_valida)}</strong>. Los
        porcentajes usan solo el área válida
        {condition.tipo === "temporal"
          ? " común a ambas fechas"
          : " de la escena"}
        . Sin datos: transparente.
      </p>
      {filterAvailable && (
        <p className="text-sm text-slate-400">
          Descargar vista PNG guarda el mapa y el resaltado actuales. Los
          informes y ZIP completos mantienen todos los resultados.
        </p>
      )}
    </>
  );
}
