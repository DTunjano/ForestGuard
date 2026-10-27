import { test } from "node:test";
import assert from "node:assert/strict";
import {
  describeArtifact,
  filterArtifacts,
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
