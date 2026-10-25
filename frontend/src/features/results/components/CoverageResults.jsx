import { useState } from "react";
import { Field, Panel, Select } from "../../../shared/components/UI";
import { PrivateImage } from "./ArtifactCard";

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
  const original = artifacts.find(
    (artifact) => artifact.relative_path === entry.original,
  );
  const result = artifacts.find(
    (artifact) =>
      artifact.relative_path === `${entry.folder}/condicion_bosque.tif`,
  );
  return (
    <section aria-label="Original y resultado de cobertura">
      <Panel>
        <div className="flex flex-wrap items-end justify-between gap-4">
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
              Resultado · categorías espectrales
            </figcaption>
            {result ? (
              <PrivateImage
                url={result.png_download_url || result.preview_url}
                label={`Mapa de cobertura ${entry.title}`}
              />
            ) : (
              <p>Mapa no disponible.</p>
            )}
          </figure>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {condition.categorias.map((category) => (
            <div
              key={category.clave}
              className="rounded-xl border border-white/15 p-4"
            >
              <dt className="flex items-start gap-2 text-sm">
                <span
                  aria-hidden="true"
                  className="mt-1 h-3 w-3 shrink-0 rounded-full"
                  style={{ background: category.color }}
                />
                {category.etiqueta}
              </dt>
              <dd className="mt-3 text-xl font-semibold">
                {category.clave === "degradacion" &&
                condition.tipo !== "temporal"
                  ? "Requiere otra fecha"
                  : percent(category.porcentaje)}
              </dd>
              {category.area_ha != null && (
                <dd className="mt-1 text-sm text-slate-400">
                  {category.area_ha.toLocaleString("es-CO", {
                    maximumFractionDigits: 2,
                  })}{" "}
                  ha
                </dd>
              )}
            </div>
          ))}
        </dl>
        <p className="text-sm text-slate-300">
          Cobertura válida:{" "}
          <strong>{percent(condition.porcentaje_cobertura_valida)}</strong>. Los
          porcentajes usan solo el área válida
          {condition.tipo === "temporal"
            ? " común a ambas fechas"
            : " de la escena"}
          . Sin datos: transparente.
        </p>
        <p className="text-sm text-slate-400">{condition.nota}</p>
        <details className="rounded-lg border border-white/10 p-3">
          <summary className="cursor-pointer font-medium">
            Reglas y trazabilidad
          </summary>
          <p className="mt-3 text-sm">
            Método {condition.version}. En comparaciones, la pérdida es inicial
            menos final. Prioridad: posible deforestación (NDVI final &lt; 0,5 o
            pérdida NDVI &gt; 0,3 sobre el proxy de bosque inicial), degradación
            (pérdida NBR entre 0,1 y 0,4), estable y otra cobertura. NDVI y
            demás índices conservan su escala técnica.
          </p>
        </details>
      </Panel>
    </section>
  );
}
