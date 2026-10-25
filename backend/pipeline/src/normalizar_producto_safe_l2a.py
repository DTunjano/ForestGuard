"""Recorta y normaliza un producto Sentinel-2 L2A SAFE extraído.

Lee las siete bandas y SCL desde sus grillas nativas, aplica la cuantificación
y los BOA_ADD_OFFSET del XML, y remuestrea a la grilla B02 de 10 m. No modifica
el producto fuente. La salida queda en el orden canónico ForestGuard.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.warp import reproject, transform_bounds
from rasterio.windows import Window, from_bounds, intersection, transform as window_transform

from esquema_bandas_forestguard import CANONICAL_BANDS


BAND_ID = {"B2": "1", "B3": "2", "B4": "3", "B5": "4",
           "B8": "7", "B11": "11", "B12": "12"}
SOURCE_RESOLUTION = {"B2": 10, "B3": 10, "B4": 10, "B8": 10,
                     "B5": 20, "B11": 20, "B12": 20, "SCL": 20}


def local_name(element):
    return element.tag.rsplit("}", 1)[-1]


def product_radiometry(metadata_path):
    root = ET.parse(metadata_path).getroot()
    values = {}
    offsets = {}
    for element in root.iter():
        name = local_name(element)
        if name in {"PRODUCT_TYPE", "PROCESSING_LEVEL", "PROCESSING_BASELINE",
                    "BOA_QUANTIFICATION_VALUE"} and element.text:
            values[name] = element.text.strip()
        if name == "BOA_ADD_OFFSET" and element.text:
            band_id = element.attrib.get("band_id")
            if band_id in offsets:
                raise ValueError(f"BOA_ADD_OFFSET duplicado para band_id={band_id}")
            offsets[band_id] = float(element.text)
    if values.get("PRODUCT_TYPE") != "S2MSI2A":
        raise ValueError("El XML no acredita un producto Sentinel-2 Level-2A")
    quant = float(values.get("BOA_QUANTIFICATION_VALUE", 0))
    if quant <= 0:
        raise ValueError("Falta BOA_QUANTIFICATION_VALUE válido")
    baseline = values.get("PROCESSING_BASELINE")
    if baseline is None:
        raise ValueError("Falta PROCESSING_BASELINE en el producto")
    if float(baseline) >= 4 and any(band_id not in offsets for band_id in BAND_ID.values()):
        raise ValueError("Faltan BOA_ADD_OFFSET de bandas requeridas")
    if float(baseline) < 4 and offsets:
        raise ValueError("Metadatos de baseline y offsets incompatibles")
    return quant, {name: offsets.get(band_id, 0.0) for name, band_id in BAND_ID.items()}, baseline


def band_files(granule):
    selected = {}
    for path in granule.glob("IMG_DATA/R*m/*.jp2"):
        match = re.search(r"_(B02|B03|B04|B05|B08|B11|B12|SCL)_(10|20)m\.jp2$",
                          path.name, flags=re.IGNORECASE)
        if not match:
            continue
        raw_band, resolution = match.groups()
        name = raw_band if raw_band == "SCL" else "B" + str(int(raw_band[1:]))
        if int(resolution) != SOURCE_RESOLUTION[name]:
            continue
        if name in selected:
            raise ValueError(f"Banda duplicada {name} en {granule}")
        selected[name] = path
    missing = set(CANONICAL_BANDS + ["SCL"]) - set(selected)
    if missing:
        raise ValueError(f"Faltan bandas L2A en {granule}: {', '.join(sorted(missing))}")
    return selected


def choose_granule(product, bbox, requested):
    granules = sorted((product / "GRANULE").iterdir())
    choices = []
    for granule in granules:
        if not granule.is_dir() or (requested and granule.name != requested):
            continue
        files = band_files(granule)
        with rasterio.open(files["B2"]) as src:
            scene_bounds = transform_bounds(src.crs, "EPSG:4326", *src.bounds)
        if (bbox[0] <= scene_bounds[2] and scene_bounds[0] <= bbox[2] and
                bbox[1] <= scene_bounds[3] and scene_bounds[1] <= bbox[3]):
            choices.append((granule, files))
    if len(choices) != 1:
        raise ValueError(f"Se esperaba un solo gránulo sobre el sector; encontrados {len(choices)}. "
                         "Usa --granulo si hay varios")
    return choices[0]


def warp_band(path, destination_shape, destination_transform, crs, method):
    with rasterio.open(path) as src:
        if src.count != 1 or src.crs != crs:
            raise ValueError(f"Banda incompatible en CRS o cantidad de bandas: {path}")
        output = np.full(destination_shape, np.nan, dtype="float32")
        reproject(
            source=rasterio.band(src, 1), destination=output,
            src_transform=src.transform, src_crs=src.crs, src_nodata=0,
            dst_transform=destination_transform, dst_crs=crs, dst_nodata=np.nan,
            resampling=method,
        )
        return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--producto", type=Path, required=True,
                        help="Directorio .SAFE extraído, con MTD_MSIL2A.xml")
    parser.add_argument("--bbox-wgs84", type=float, nargs=4, required=True,
                        metavar=("OESTE", "SUR", "ESTE", "NORTE"))
    parser.add_argument("--granulo", help="Nombre exacto bajo GRANULE, si hay varios")
    parser.add_argument("--salida", type=Path, required=True)
    args = parser.parse_args()
    bbox = args.bbox_wgs84
    if not (-180 <= bbox[0] < bbox[2] <= 180 and -90 <= bbox[1] < bbox[3] <= 90):
        raise ValueError("La envolvente WGS84 es inválida")
    product = args.producto.resolve()
    if not product.is_dir() or not (product / "MTD_MSIL2A.xml").is_file():
        raise ValueError("Se requiere un directorio Sentinel-2 L2A .SAFE extraído")
    if args.salida.exists() or args.salida.with_suffix(".json").exists():
        raise FileExistsError("La salida o su reporte ya existen")
    quant, offsets, baseline = product_radiometry(product / "MTD_MSIL2A.xml")
    granule, files = choose_granule(product, bbox, args.granulo)
    with rasterio.open(files["B2"]) as reference:
        if not reference.crs or not reference.crs.is_projected or abs(reference.crs.linear_units_factor[1] - 1) >= 1e-9:
            raise ValueError("La grilla B02 requiere CRS proyectado en metros")
        if any(abs(value - 10) >= 0.01 for value in reference.res):
            raise ValueError("La grilla B02 no tiene resolución de 10 m")
        native_bbox = transform_bounds("EPSG:4326", reference.crs, *bbox)
        window = intersection(from_bounds(*native_bbox, transform=reference.transform)
                              .round_offsets().round_lengths(),
                              Window(0, 0, reference.width, reference.height))
        if window.width * window.height > 5_000_000:
            raise ValueError("El recorte supera cinco millones de píxeles")
        crs = reference.crs
        transform_out = window_transform(window, reference.transform)
        shape = (int(window.height), int(window.width))
    stack = []
    for name in CANONICAL_BANDS:
        method = Resampling.nearest if SOURCE_RESOLUTION[name] == 10 else Resampling.bilinear
        dn = warp_band(files[name], shape, transform_out, crs, method)
        reflectance = (dn + offsets[name]) / quant
        reflectance[~np.isfinite(dn)] = np.nan
        stack.append(reflectance.astype("float32"))
    scl = warp_band(files["SCL"], shape, transform_out, crs, Resampling.nearest)
    valid = np.isin(scl, (4, 5))
    for band in stack:
        valid &= np.isfinite(band) & (band >= 0) & (band <= 1)
    if not valid.any():
        raise ValueError("No hay píxeles válidos con SCL 4/5 y reflectancia 0-1")
    cube = np.stack(stack)
    cube[:, ~valid] = np.nan
    profile = dict(driver="GTiff", height=shape[0], width=shape[1], count=7,
                   dtype="float32", crs=crs, nodata=np.nan,
                   transform=transform_out, compress="deflate", predictor=3)
    args.salida.parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(args.salida, "w", **profile) as dst:
        for number, name in enumerate(CANONICAL_BANDS, 1):
            dst.write(cube[number - 1], number)
            dst.set_band_description(number, name)
        dst.update_tags(
            processing="Copia estandarizada de 7 bandas espectrales tras máscara SCL",
            band_order=",".join(CANONICAL_BANDS), metodo_mascara="SCL_4_5",
            origen_formato="Sentinel-2 L2A SAFE", producto_fuente=str(product),
            granulo_fuente=granule.name, boa_quantification_value=str(quant),
            processing_baseline=baseline,
        )
    report = {
        "producto": str(product), "granulo": granule.name,
        "bbox_solicitada_wgs84": bbox, "salida": str(args.salida.resolve()),
        "orden_salida": CANONICAL_BANDS, "grilla": "B02_10m",
        "remuestreo_reflectancia_20m": "bilinear",
        "remuestreo_scl": "nearest", "cuantificacion": quant,
        "boa_add_offset_por_banda": offsets,
        "processing_baseline": baseline,
        "pixeles_validos": int(valid.sum()), "pixeles_totales": int(valid.size),
        "fuentes": {name: str(path) for name, path in files.items()},
        "alcance": "normalización técnica; desempeño del modelo en este producto por evaluar",
    }
    args.salida.with_suffix(".json").write_text(json.dumps(report, ensure_ascii=False,
                                                     indent=2), encoding="utf-8")
    print(json.dumps({"salida": str(args.salida), "pixeles_validos": int(valid.sum()),
                      "grilla": "B02_10m"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
