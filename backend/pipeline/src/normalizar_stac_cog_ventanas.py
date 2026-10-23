"""Normaliza bandas COG locales descritas por un Item STAC L2A, por ventanas.

Se pasan ocho argumentos --asset de forma BANDA=CLAVE_STAC=RUTA_LOCAL.
Aplica scale/offset de raster:bands y SCL 4/5; nunca descarga activos remotos.
"""

from __future__ import annotations

import argparse
from contextlib import ExitStack
import json
from pathlib import Path

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.vrt import WarpedVRT
from rasterio.warp import transform_bounds
from rasterio.windows import Window, from_bounds, intersection, transform as window_transform

from esquema_bandas_forestguard import CANONICAL_BANDS


NAMES = (*CANONICAL_BANDS, "SCL")
NATIVE_10M = {"B2", "B3", "B4", "B8"}


def parse_assets(values):
    result = {}
    for raw in values:
        parts = raw.split("=", 2)
        if len(parts) != 3 or parts[0] not in NAMES or parts[0] in result:
            raise ValueError("Usa --asset BANDA=CLAVE_STAC=RUTA_LOCAL una vez por banda")
        result[parts[0]] = (parts[1], Path(parts[2]).resolve())
    if set(result) != set(NAMES):
        raise ValueError(f"Se requieren exactamente: {', '.join(NAMES)}")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--item-stac", required=True, type=Path)
    parser.add_argument("--asset", action="append", required=True,
                        help="BANDA=CLAVE_STAC=RUTA_LOCAL, repetir ocho veces")
    parser.add_argument("--bbox-wgs84", nargs=4, type=float, required=True,
                        metavar=("OESTE", "SUR", "ESTE", "NORTE"))
    parser.add_argument("--salida", required=True, type=Path)
    parser.add_argument("--ventana", type=int, default=512)
    args = parser.parse_args()
    if not 64 <= args.ventana <= 1024:
        parser.error("--ventana debe estar entre 64 y 1024")
    bbox = args.bbox_wgs84
    if not (-180 <= bbox[0] < bbox[2] <= 180 and -90 <= bbox[1] < bbox[3] <= 90):
        raise ValueError("Envolvente WGS84 inválida")
    if args.salida.exists() or args.salida.with_suffix(".json").exists():
        raise FileExistsError("La salida o su reporte ya existen")
    item = json.loads(args.item_stac.read_text(encoding="utf-8-sig"))
    if item.get("type") != "Feature" or "assets" not in item:
        raise ValueError("Se requiere un Item STAC individual, no una colección")
    assets = parse_assets(args.asset)
    if len({key for key, _ in assets.values()}) != 8:
        raise ValueError("Las ocho bandas requieren activos STAC distintos")
    radiometry = {}
    for name, (key, path) in assets.items():
        if key not in item["assets"] or not path.is_file():
            raise FileNotFoundError(f"Activo STAC o COG local ausente: {name}")
        metadata = item["assets"][key]
        bands = metadata.get("raster:bands", [])
        if len(bands) != 1:
            raise ValueError(f"Falta raster:bands de una banda: {key}")
        scale = float(bands[0].get("scale", 1))
        offset = float(bands[0].get("offset", 0))
        if name == "SCL":
            if scale != 1 or offset != 0:
                raise ValueError("SCL debe tener escala 1 y offset 0")
        elif not 0 < scale <= 1 or not -1 <= offset <= 1:
            raise ValueError(f"Escala/offset inesperados: {name}")
        radiometry[name] = (scale, offset)
    with rasterio.open(assets["B2"][1]) as ref:
        if (ref.count != 1 or ref.crs is None or not ref.crs.is_projected or
                abs(ref.crs.linear_units_factor[1]-1) > 1e-9 or
                any(abs(value-10) > .01 for value in ref.res)):
            raise ValueError("B02 requiere un COG de una banda en grilla 10 m")
        native = transform_bounds("EPSG:4326", ref.crs, *bbox)
        clip = intersection(from_bounds(*native, transform=ref.transform)
                            .round_offsets().round_lengths(),
                            Window(0, 0, ref.width, ref.height))
        height, width = int(clip.height), int(clip.width)
        if height <= 0 or width <= 0:
            raise ValueError("La envolvente no intersecta B02")
        transform = window_transform(clip, ref.transform)
        crs = ref.crs
    profile = {"driver": "GTiff", "height": height, "width": width,
               "count": 7, "dtype": "float32", "crs": crs,
               "transform": transform, "nodata": np.nan, "compress": "deflate",
               "predictor": 3, "BIGTIFF": "IF_SAFER"}
    args.salida.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.salida.with_name(args.salida.name + ".partial.tif")
    if temporary.exists():
        raise FileExistsError(temporary)
    count_valid = 0
    try:
        with ExitStack() as stack:
            readers = {}
            for name, (_, path) in assets.items():
                src = stack.enter_context(rasterio.open(path))
                if src.count != 1 or src.crs != crs:
                    raise ValueError(f"Banda COG incompatible: {path}")
                method = (Resampling.nearest if name == "SCL" or name in NATIVE_10M
                          else Resampling.bilinear)
                readers[name] = stack.enter_context(WarpedVRT(
                    src, crs=crs, transform=transform, width=width, height=height,
                    src_nodata=0, nodata=np.nan, resampling=method))
            with rasterio.open(temporary, "w", **profile) as dst:
                for number, name in enumerate(CANONICAL_BANDS, 1):
                    dst.set_band_description(number, name)
                for row in range(0, height, args.ventana):
                    for col in range(0, width, args.ventana):
                        window = Window(col, row, min(args.ventana, width-col),
                                        min(args.ventana, height-row))
                        shape = (int(window.height), int(window.width))
                        scl = readers["SCL"].read(1, window=window,
                                                  masked=True, out_dtype="float32")
                        valid = (~np.ma.getmaskarray(scl)) & np.isin(scl.filled(np.nan), (4, 5))
                        cube = np.empty((7, *shape), dtype=np.float32)
                        for number, name in enumerate(CANONICAL_BANDS):
                            raw = readers[name].read(1, window=window,
                                                     masked=True, out_dtype="float32")
                            scale, offset = radiometry[name]
                            values = raw.filled(np.nan) * scale + offset
                            valid &= (~np.ma.getmaskarray(raw)) & np.isfinite(values)
                            valid &= (values >= 0) & (values <= 1)
                            cube[number] = values
                        cube[:, ~valid] = np.nan
                        dst.write(cube, window=window)
                        count_valid += int(valid.sum())
                dst.update_tags(
                    processing="Copia estandarizada de 7 bandas espectrales tras máscara SCL",
                    band_order=",".join(CANONICAL_BANDS), metodo_mascara="SCL_4_5",
                    origen_formato="STAC COG L2A local", item_stac=str(item.get("id", "")),
                )
        if not count_valid:
            raise ValueError("No quedaron píxeles válidos tras SCL y radiometría")
        temporary.replace(args.salida)
    finally:
        if temporary.exists():
            temporary.unlink()
    report = {"item_stac": item.get("id"), "item_archivo": str(args.item_stac.resolve()),
              "activos_locales": {name: {"clave": key, "ruta": str(path)}
                                  for name, (key, path) in assets.items()},
              "radiometria": {name: {"scale": scale, "offset": offset}
                             for name, (scale, offset) in radiometry.items()},
              "bbox_solicitada_wgs84": bbox, "salida": str(args.salida.resolve()),
              "pixeles_validos": count_valid, "pixeles_totales": width*height,
              "ventana_pixeles": args.ventana}
    args.salida.with_suffix(".json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"salida": str(args.salida), "pixeles_validos": count_valid},
                     ensure_ascii=False))


if __name__ == "__main__":
    main()
