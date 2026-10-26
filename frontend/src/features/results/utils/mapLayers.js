export const INDEX_LAYERS = [
  { id: "NDVI", bands: "B8 y B4", description: "Actividad de la vegetación" },
  { id: "NDMI", bands: "B8 y B11", description: "Humedad de la vegetación" },
  {
    id: "NBR",
    bands: "B8 y B12",
    description: "Condición de la cobertura y estructura vegetal",
  },
  {
    id: "NDRE",
    bands: "B8 y B5",
    description: "Respuesta de la vegetación en el borde rojo",
  },
];

export function decodeMask(data) {
  if (
    data.encoding !== "uint8-base64" ||
    !Number.isInteger(data.width) ||
    !Number.isInteger(data.height) ||
    data.nodata !== 255 ||
    data.width < 1 ||
    data.height < 1 ||
    data.width > 768 ||
    data.height > 768
  )
    throw new Error("La máscara de cobertura no tiene un formato válido.");
  const values = Uint8Array.from(atob(data.values), (character) =>
    character.charCodeAt(0),
  );
  if (values.length !== data.width * data.height)
    throw new Error("La máscara de cobertura está incompleta.");
  return { ...data, values };
}

export function sameGrid(first, second) {
  return (
    !!first &&
    !!second &&
    first.width === second.width &&
    first.height === second.height &&
    first.crs === second.crs &&
    Array.isArray(first.transform) &&
    Array.isArray(second.transform) &&
    first.transform.length === second.transform.length &&
    first.transform.every(
      (value, index) => Math.abs(value - second.transform[index]) < 1e-8,
    )
  );
}

// Selection changes only display opacity. Area statistics always come from the server.
export function composeMap(
  mask,
  categories,
  selected,
  contextOpacity,
  layerPixels,
) {
  const output = new Uint8ClampedArray(mask.values.length * 4);
  const colors = new Map(
    categories.map((category) => [
      category.valor,
      category.color
        .match(/[a-f\d]{2}/gi)
        .map((channel) => parseInt(channel, 16)),
    ]),
  );
  const filter = new Set(selected);
  for (let pixel = 0; pixel < mask.values.length; pixel++) {
    const category = mask.values[pixel];
    if (category === mask.nodata || !colors.has(category)) continue;
    const offset = pixel * 4;
    const color = colors.get(category);
    output[offset] = layerPixels ? layerPixels[offset] : color[0];
    output[offset + 1] = layerPixels ? layerPixels[offset + 1] : color[1];
    output[offset + 2] = layerPixels ? layerPixels[offset + 2] : color[2];
    const alpha = layerPixels ? layerPixels[offset + 3] : 255;
    output[offset + 3] =
      alpha * (!filter.size || filter.has(category) ? 1 : contextOpacity / 100);
  }
  return output;
}
