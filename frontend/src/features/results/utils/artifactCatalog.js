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
