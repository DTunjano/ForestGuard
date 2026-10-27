import { test } from "node:test";
import assert from "node:assert/strict";
import {
  describeArtifact,
  filterArtifacts,
  explorationArtifacts,
  paletteVariants,
  conditionReading,
} from "../src/features/results/utils/artifactCatalog.js";

const artifact = (id, path, kind = "visualization") =>
  describeArtifact({
    id,
    relative_path: path,
    kind,
    label: path,
    png_download_url: kind === "raster" ? "/private.png" : null,
  });
test("catalog groups every result and keeps dates, intervals and file identity", () => {
  const entries = [
    artifact(1, "visualizacion_comparativa.png"),
    artifact(2, "fechas/2024-01-01/NDVI.tif", "raster"),
    artifact(3, "intervalos/2024-01-01_2024-03-01/dNDMI.tif", "raster"),
    artifact(4, "reporte.pdf", "report"),
  ];
  assert.deepEqual(
    entries.map((item) => item.category),
    ["overview", "individual", "comparisons", "reports"],
  );
  assert.equal(entries[2].periodLabel, "2024-01-01 a 2024-03-01");
  assert.match(entries[2].title, /humedad/);
  assert.deepEqual(
    filterArtifacts(entries, {
      category: "all",
      search: "",
      period: "",
      format: "",
    }).map((item) => item.id),
    [1, 2, 3, 4],
  );
});

test("reading uses the measured dominant category and never turns missing data into zero loss", () => {
  assert.match(
    conditionReading({
      categorias: [
        { etiqueta: "Vegetación de vigor alto", porcentaje: 70 },
        { etiqueta: "Degradación", porcentaje: null },
        { etiqueta: "Otra cobertura", porcentaje: 30 },
      ],
    }),
    /Vegetación de vigor alto.*70 %/,
  );
  assert.match(conditionReading({ categorias: [] }), /No hay porcentajes/);
  assert.match(
    conditionReading({ categorias: [{ porcentaje: 0 }] }),
    /No hay porcentajes/,
  );
});

test("exploration separates indices from raw technical files and combines palette variants", () => {
  const items = [
    artifact(1, "visualizacion_individual.png"),
    artifact(2, "visualizacion_individual_contraste.png"),
    artifact(3, "fechas/2024-01-01/NDVI.tif", "raster"),
    artifact(4, "fechas/2024-01-01/condicion_bosque.tif", "raster"),
    artifact(5, "intervalos/2024-01-01_2024-03-01/prediccion.tif", "raster"),
    artifact(6, "resumen_serie.json", "report"),
    artifact(7, "fechas/2024-01-01/resumen_fecha.png"),
    artifact(8, "fechas/2024-01-01/resumen_fecha_contraste.png"),
    artifact(9, "fechas/2024-03-01/resumen_fecha_contraste.png"),
    artifact(10, "intervalos/2024-01-01_2024-03-01/dNDMI.tif", "raster"),
  ];
  assert.deepEqual(
    explorationArtifacts(items).map((item) => item.id),
    [1, 3, 7, 9, 10],
  );
  assert.deepEqual(
    paletteVariants(items[6], items).map((item) => item.id),
    [7, 8],
  );
  assert.deepEqual(
    paletteVariants(items[8], items).map((item) => item.id),
    [9],
  );
  assert.equal(items.length, 10); // The full technical catalog keeps every file.
});
test("search understands accents and filters PNG availability without losing raster downloads", () => {
  const items = [
    artifact(1, "fechas/2024-01-01/resumen_fecha.png"),
    artifact(2, "fechas/2024-01-01/NDVI.tif", "raster"),
    artifact(3, "reporte.pdf", "report"),
  ];
  const filters = {
    category: "all",
    search: "indices",
    period: "",
    format: "",
  };
  assert.deepEqual(
    filterArtifacts(items, filters).map((item) => item.id),
    [1],
  );
  assert.deepEqual(
    filterArtifacts(items, { ...filters, search: "", format: "png" }).map(
      (item) => item.id,
    ),
    [1, 2],
  );
  assert.deepEqual(
    filterArtifacts(items, { ...filters, search: "", period: "missing" }),
    [],
  );
  assert.deepEqual(
    filterArtifacts(items, { ...filters, search: "", format: "tiff" }).map(
      (item) => item.id,
    ),
    [2],
  );
});
