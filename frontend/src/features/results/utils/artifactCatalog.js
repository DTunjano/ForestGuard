import { INDEX_LAYERS } from "./mapLayers.js";

const titles = {
  visualizacion_individual: "Resumen de todas las fechas",
  visualizacion_individual_contraste: "Resumen de fechas · contraste",
  visualizacion_comparativa: "Resumen de comparaciones",
  resumen_fecha: "Índices de la fecha",
  resumen_fecha_contraste: "Índices de la fecha · contraste",
  resumen_condicion: "Cobertura: original y resultado",
  mapas_original_resultado: "Original y cobertura",
  resumen_cambio: "Índices de cambio",
  condicion_bosque: "Mapa de cobertura",
  original_rgb: "Imagen original",
  original_final_rgb: "Imagen original · fecha final",
  reporte: "Informe completo",
  resumen_serie: "Resumen y métricas",
};

export const normalizeSearch = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function describeArtifact(artifact) {
  const parts = artifact.relative_path.split("/");
  const filename = parts.at(-1);
  const stem = filename.replace(/\.[^.]+$/, "");
  const ext = filename.split(".").at(-1).toLowerCase();
  const format = ext === "tif" || ext === "tiff" ? "tiff" : ext;
  const overview = artifact.kind === "visualization" && parts.length === 1;
  const category = overview
    ? "overview"
    : parts[0] === "fechas"
      ? "individual"
      : parts[0] === "intervalos"
        ? "comparisons"
        : ["pdf", "json"].includes(format) && parts.length === 1
          ? "reports"
          : "other";
  const period = ["individual", "comparisons"].includes(category)
    ? parts[1]
    : "";
  const index = INDEX_LAYERS.find((item) => item.id === stem.replace(/^d/, ""));
  const title =
    titles[stem] ||
    (index
      ? `${index.id} · ${stem.startsWith("d") ? index.changeLabel : index.label}`
      : artifact.label);
  return {
    ...artifact,
    title,
    filename,
    format,
    category,
    period,
    periodLabel: period ? period.replace("_", " a ") : "Estudio completo",
    searchText: normalizeSearch(
      `${title} ${artifact.label} ${artifact.relative_path}`,
    ),
  };
}

export function filterArtifacts(items, { category, search, period, format }) {
  const term = normalizeSearch(search.trim());
  return items.filter(
    (item) =>
      (category === "all" || item.category === category) &&
      (!term || item.searchText.includes(term)) &&
      (!period || item.period === period) &&
      (!format ||
        item.format === format ||
        (format === "png" && item.kind === "raster" && item.png_download_url)),
  );
}

// A palette is a view of the same map, not an additional finding.
export function explorationArtifacts(artifacts) {
  return artifacts
    .filter((artifact) => {
      const name = artifact.relative_path.split("/").at(-1);
      return /^(?:d?(?:NDVI|NDMI|NBR|NDRE)\.tiff?|resumen_(?:fecha|cambio)(?:_contraste)?\.png|visualizacion_(?:individual(?:_contraste)?|comparativa)\.png)$/i.test(
        name,
      );
    })
    .filter(
      (artifact, _, candidates) =>
        !artifact.relative_path.includes("_contraste.") ||
        !candidates.some(
          (other) =>
            other.relative_path ===
            artifact.relative_path.replace("_contraste.", "."),
        ),
    );
}

export function paletteVariants(artifact, artifacts) {
  const base = artifact.relative_path.replace("_contraste.", ".");
  return artifacts.filter(
    (item) => item.relative_path.replace("_contraste.", ".") === base,
  );
}

export function conditionReading(condition) {
  const measured = (condition.categorias || []).filter((item) =>
    Number.isFinite(item.porcentaje),
  );
  const dominant = measured.reduce(
    (largest, item) =>
      !largest || item.porcentaje > largest.porcentaje ? item : largest,
    null,
  );
  if (!dominant || dominant.porcentaje <= 0)
    return "No hay porcentajes de cobertura disponibles para este periodo.";
  const value = dominant.porcentaje.toLocaleString("es-CO", {
    maximumFractionDigits: 2,
  });
  return `La categoría con mayor superficie es «${dominant.etiqueta}», con ${value} % del área válida evaluada.`;
}
