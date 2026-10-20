"""Normaliza un GeoTIFF Sentinel-2 descrito por bandas, sin alterar el original.

La escala espectral y el factor SCL se declaran explícitamente. Nunca se
infieren por la posición de una banda ni por el rango observado.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import re

import numpy as np
import rasterio
from rasterio.windows import Window

from esquema_bandas_forestguard import CANONICAL_BANDS


def nombre_banda(description):
    text = str(description or "").strip().upper()
    match = re.match(r"^(B0?[2-5]|B0?8|B11|B12)(?=$|\W)", text)
    if match:
        return "B" + str(int(match.group(1)[1:]))
    if re.match(r"^SCL(?=$|\W)", text):
        return "SCL"
    return None


def bandas_por_descripcion(src):
    selected = {}
    for number, description in enumerate(src.descriptions, start=1):
        name = nombre_banda(description)
        if name in set(CANONICAL_BANDS) | {"SCL"}:
            if name in selected:
                raise ValueError(f"Banda duplicada {name}: {selected[name]} y {number}")
            selected[name] = number
    missing = set(CANONICAL_BANDS) - set(selected)
    if missing:
        raise ValueError(f"Faltan bandas: {', '.join(sorted(missing))}")
    return selected


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--entrada", type=Path, required=True)
    parser.add_argument("--salida", type=Path, required=True,
                        help="GeoTIFF nuevo de siete bandas")
    parser.add_argument("--escala-reflectancia", choices=("fraccion", "dividir_10000"),
                        required=True)
    parser.add_argument("--factor-scl", type=int, choices=(1, 10000),
                        help="Factor para recuperar clases enteras SCL; obligatorio si hay SCL")
    parser.add_argument("--sin-scl", action="store_true",
                        help="Solo índices descriptivos; este producto no podrá entrar al modelo")
    parser.add_argument("--ventana", type=int, default=512,
                        help="Lado de ventana en píxeles (64 a 1024)")
    args = parser.parse_args()
    if not 64 <= args.ventana <= 1024:
        parser.error("--ventana debe estar entre 64 y 1024")
    if args.entrada.resolve() == args.salida.resolve():
        raise ValueError("La salida no puede sobrescribir la entrada")
    if args.salida.exists() or args.salida.with_suffix(".json").exists():
        raise FileExistsError("La salida o su reporte ya existen")
    with rasterio.open(args.entrada) as src:
        if src.driver != "GTiff" or src.crs is None or src.width <= 0 or src.height <= 0:
            raise ValueError("Se requiere GeoTIFF georreferenciado con CRS y dimensiones válidas")
        if any(scale != 1 for scale in src.scales) or any(offset != 0 for offset in src.offsets):
            raise ValueError("El archivo declara escala o desplazamiento por banda; revisar antes de procesar")
        mapping = bandas_por_descripcion(src)
        if not args.sin_scl and "SCL" not in mapping:
            raise ValueError("Falta SCL; usa --sin-scl solo para análisis descriptivo")
        if not args.sin_scl and args.factor_scl is None:
            raise ValueError("Debes declarar --factor-scl 1 o 10000")
        if args.sin_scl and args.factor_scl is not None:
            raise ValueError("--factor-scl no se combina con --sin-scl")
        profile = src.profile.copy()
        profile.update(driver="GTiff", count=7, dtype="float32", nodata=np.nan,
                       compress="deflate", predictor=3, BIGTIFF="IF_SAFER")
        args.salida.parent.mkdir(parents=True, exist_ok=True)
        temporary = args.salida.with_name(args.salida.name + ".partial.tif")
        if temporary.exists():
            raise FileExistsError(temporary)
        valid_count = 0
        observed_max = float("-inf")
        scl_classes_seen = set()
        try:
            with rasterio.open(temporary, "w", **profile) as dst:
                for number, name in enumerate(CANONICAL_BANDS, start=1):
                    dst.set_band_description(number, name)
                for row in range(0, src.height, args.ventana):
                    for col in range(0, src.width, args.ventana):
                        window = Window(col, row, min(args.ventana, src.width - col),
                                        min(args.ventana, src.height - row))
                        raw = src.read([mapping[name] for name in CANONICAL_BANDS],
                                       window=window, masked=True, out_dtype="float32")
                        observed = raw.compressed()
                        if observed.size:
                            observed_max = max(observed_max, float(np.nanmax(observed)))
                        cube = raw.filled(np.nan).astype(np.float32)
                        if args.escala_reflectancia == "dividir_10000":
                            cube /= 10000.0
                        valid = np.all(~np.ma.getmaskarray(raw), axis=0)
                        valid &= np.all(np.isfinite(cube) & (cube >= 0) & (cube <= 1), axis=0)
                        if not args.sin_scl:
                            scl_raw = src.read(mapping["SCL"], window=window,
                                               masked=True, out_dtype="float32")
                            scl_values = scl_raw.filled(np.nan) * args.factor_scl
                            rounded = np.rint(np.nan_to_num(scl_values, nan=0)).astype(np.int16)
                            valid_scl = (~np.ma.getmaskarray(scl_raw)) & np.isfinite(scl_values)
                            valid_scl &= np.abs(scl_values - rounded) <= 0.05
                            scl_classes_seen.update(int(value) for value in np.unique(rounded[valid_scl]))
                            valid &= valid_scl & np.isin(rounded, (4, 5))
                        valid_count += int(valid.sum())
                        cube[:, ~valid] = np.nan
                        dst.write(cube, window=window)
                dst.update_tags(
                    processing=("Copia estandarizada de 7 bandas espectrales tras máscara SCL"
                                if not args.sin_scl else
                                "Copia estandarizada de 7 bandas espectrales sin SCL"),
                    band_order=",".join(CANONICAL_BANDS),
                    metodo_mascara="SCL" if not args.sin_scl else "NINGUNO",
                    escala_reflectancia=args.escala_reflectancia,
                    factor_scl=str(args.factor_scl or ""),
                    archivo_origen=str(args.entrada.resolve()),
                )
            if args.escala_reflectancia == "dividir_10000" and observed_max <= 1:
                raise ValueError("Las bandas ya parecen fraccionarias; no corresponde dividir entre 10000")
            if not args.sin_scl and not scl_classes_seen.intersection({4, 5}):
                raise ValueError("SCL no contiene clases 4/5 con el factor declarado")
            if not valid_count:
                raise ValueError("No quedaron píxeles válidos con la escala y SCL declaradas")
            temporary.replace(args.salida)
        finally:
            if temporary.exists():
                temporary.unlink()
        report = {
            "entrada": str(args.entrada.resolve()),
            "salida": str(args.salida.resolve()),
            "bandas_origen": mapping,
            "orden_salida": list(CANONICAL_BANDS),
            "escala_reflectancia": args.escala_reflectancia,
            "factor_scl": args.factor_scl,
            "clases_scl_observadas": sorted(scl_classes_seen),
            "mascara_calidad": "SCL_4_5" if not args.sin_scl else "NINGUNA",
            "apto_para_modelo_temporal": not args.sin_scl and
                                        src.crs.is_projected and
                                        abs(src.crs.linear_units_factor[1] - 1) < 1e-9 and
                                        all(abs(value - 10) < 0.01 for value in src.res),
            "pixeles_validos": valid_count,
            "pixeles_totales": src.width * src.height,
            "crs": str(src.crs),
            "resolucion": [float(value) for value in src.res],
        }
        args.salida.with_suffix(".json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
