import { test } from "node:test";
import assert from "node:assert/strict";
import {
  composeMap,
  decodeMask,
  sameGrid,
} from "../src/features/results/utils/mapLayers.js";

const categories = [
  { valor: 0, color: "#87939f", porcentaje: 25 },
  { valor: 1, color: "#369b61", porcentaje: 25 },
  { valor: 2, color: "#eab949", porcentaje: 25 },
  { valor: 3, color: "#dc504c", porcentaje: 25 },
];
const mask = {
  width: 5,
  height: 1,
  nodata: 255,
  values: new Uint8Array([0, 1, 2, 3, 255]),
};
test("category selection dims only other labels and leaves NoData transparent", () => {
  const before = structuredClone(categories);
  const pixels = composeMap(mask, categories, [2, 3], 20);
  assert.deepEqual(
    [...pixels],
    [
      135, 147, 159, 51, 54, 155, 97, 51, 234, 185, 73, 255, 220, 80, 76, 255,
      0, 0, 0, 0,
    ],
  );
  assert.deepEqual(categories, before);
  assert.deepEqual(
    [...composeMap(mask, categories, [], 0)].filter((_, i) => i % 4 === 3),
    [255, 255, 255, 255, 0],
  );
  assert.deepEqual(
    [...composeMap(mask, categories, [1], 0)].filter((_, i) => i % 4 === 3),
    [0, 255, 0, 0, 0],
  );
});
test("index layers retain their pixels and transparency while using category IDs", () => {
  const source = new Uint8ClampedArray([
    10, 20, 30, 255, 40, 50, 60, 255, 70, 80, 90, 0, 100, 110, 120, 255, 9, 9,
    9, 255,
  ]);
  const pixels = composeMap(mask, categories, [1, 2], 0, source);
  assert.deepEqual(
    [...pixels],
    [
      10, 20, 30, 0, 40, 50, 60, 255, 70, 80, 90, 0, 100, 110, 120, 0, 0, 0, 0,
      0,
    ],
  );
});
test("decode raw labels and reject incomplete/oversized masks", () => {
  const data = {
    ...mask,
    encoding: "uint8-base64",
    values: Buffer.from(mask.values).toString("base64"),
  };
  assert.deepEqual(decodeMask(data).values, mask.values);
  assert.throws(() => decodeMask({ ...data, width: 800 }));
  assert.throws(() => decodeMask({ ...data, width: 6 }));
});
test("layers must use the same source grid, including extent", () => {
  const grid = {
    width: 50,
    height: 50,
    crs: "EPSG:32618",
    transform: [10, 0, 500000, 0, -10, 500000],
  };
  assert.equal(sameGrid(grid, structuredClone(grid)), true);
  assert.equal(
    sameGrid(grid, { ...grid, transform: [10, 0, 500010, 0, -10, 500000] }),
    false,
  );
  assert.equal(sameGrid(grid, { ...grid, width: 51 }), false);
  assert.equal(sameGrid(grid, null), false);
});
