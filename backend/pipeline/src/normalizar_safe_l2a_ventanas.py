"""Normaliza un SAFE L2A extraído por ventanas, incluso para recortes grandes."""

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
from normalizar_producto_safe_l2a import (
    SOURCE_RESOLUTION, choose_granule, product_radiometry,
)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--producto", type=Path, required=True)
    parser.add_argument("--bbox-wgs84", type=float, nargs=4, required=True,
                        metavar=("OESTE", "SUR", "ESTE", "NORTE"))
    parser.add_argument("--granulo")
    parser.add_argument("--salida", type=Path, required=True)
    parser.add_argument("--ventana", type=int, default=512)
    args = parser.parse_args()
    if not 64 <= args.ventana <= 1024:
        parser.error("--ventana debe estar entre 64 y 1024")
    bbox = args.bbox_wgs84
    if not (-180 <= bbox[0] < bbox[2] <= 180 and -90 <= bbox[1] < bbox[3] <= 90):
        raise ValueError("Envolvente WGS84 inválida")
    product = args.producto.resolve()
    if not (product / "MTD_MSIL2A.xml").is_file():
        raise ValueError("Se requiere un SAFE L2A extraído")
    if args.salida.exists() or args.salida.with_suffix(".json").exists():
        raise FileExistsError("La salida o su reporte ya existen")
    quant, offsets, baseline = product_radiometry(product / "MTD_MSIL2A.xml")
    granule, files = choose_granule(product, bbox, args.granulo)
    with rasterio.open(files["B2"]) as ref:
        if (ref.crs is None or not ref.crs.is_projected or
                abs(ref.crs.linear_units_factor[1]-1) > 1e-9 or
                any(abs(value-10) > .01 for value in ref.res)):
            raise ValueError("B02 requiere una grilla de 10 m proyectada en metros")
        native = transform_bounds("EPSG:4326", ref.crs, *bbox)
        clip = intersection(from_bounds(*native, transform=ref.transform)
                            .round_offsets().round_lengths(),
                            Window(0, 0, ref.width, ref.height))
        height, width = int(clip.height), int(clip.width)
        if height <= 0 or width <= 0:
            raise ValueError("El recorte no intersecta B02")
        transform = window_transform(clip, ref.transform)
        crs = ref.crs
    profile = {"driver": "GTiff", "height": height, "width": width,
               "count": 7, "dtype": "float32", "crs": crs,
               "transform": transform, "nodata": np.nan, "compress": "deflate",
               "predictor": 3, "BIGTIFF": "IF_SAFER"}
    target = args.salida
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_name(target.name + ".partial.tif")
    if temporary.exists():
        raise FileExistsError(temporary)
    valid_count = 0
    try:
        with ExitStack() as stack:
            readers = {}
            for name, path in files.items():
                src = stack.enter_context(rasterio.open(path))
                if src.count != 1 or src.crs != crs:
                    raise ValueError(f"Banda SAFE incompatible: {path}")
                method = (Resampling.nearest if name == "SCL" or
                          SOURCE_RESOLUTION[name] == 10 else Resampling.bilinear)
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
                        for index, name in enumerate(CANONICAL_BANDS):
                            dn = readers[name].read(1, window=window,
                                                    masked=True, out_dtype="float32")
                            reflectance = (dn.filled(np.nan) + offsets[name]) / quant
                            valid &= (~np.ma.getmaskarray(dn)) & np.isfinite(reflectance)
                            valid &= (reflectance >= 0) & (reflectance <= 1)
                            cube[index] = reflectance
                        cube[:, ~valid] = np.nan
                        dst.write(cube, window=window)
                        valid_count += int(valid.sum())
                dst.update_tags(
                    processing="Copia estandarizada de 7 bandas espectrales tras máscara SCL",
                    band_order=",".join(CANONICAL_BANDS), metodo_mascara="SCL_4_5",
                    origen_formato="Sentinel-2 L2A SAFE",
                    producto_fuente=str(product), granulo_fuente=granule.name,
                    boa_quantification_value=str(quant), processing_baseline=baseline,
                )
        if not valid_count:
            raise ValueError("No quedaron píxeles válidos tras SCL y radiometría")
        temporary.replace(target)
    finally:
        if temporary.exists():
            temporary.unlink()
    report = {"producto": str(product), "granulo": granule.name,
              "bbox_solicitada_wgs84": bbox, "salida": str(target.resolve()),
              "pixeles_validos": valid_count, "pixeles_totales": width*height,
              "cuantificacion": quant, "boa_add_offset_por_banda": offsets,
              "processing_baseline": baseline, "bandas": CANONICAL_BANDS,
              "resolucion_m": 10, "ventana_pixeles": args.ventana}
    target.with_suffix(".json").write_text(json.dumps(report, ensure_ascii=False, indent=2),
                                           encoding="utf-8")
    print(json.dumps({"salida": str(target), "pixeles_validos": valid_count},
                     ensure_ascii=False))


if __name__ == "__main__":
    main()
