"""Infiere cambio histórico con memoria acotada por ventanas de píxeles.

Acepta el mismo modelo y las mismas escenas que inferir_par_ideam.py. La
salida es exploratoria y su puntaje no está calibrado como riesgo futuro.
"""

from __future__ import annotations

import argparse
from datetime import date
import json
from pathlib import Path

import joblib
import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.vrt import WarpedVRT
from rasterio.windows import Window

from construir_dataset_ml_ideam import FEATURES
from contrato_inferencia_ideam import VERSION, construir_predictores
from dominio_territorial_ideam import evaluar_escena
from esquema_bandas_forestguard import HISTORICAL_BANDS
from inferir_par_ideam import validar_entrada, validar_fecha_nombre


def read_window(src, indexes, window):
    masked = src.read(indexes, window=window, masked=True, out_dtype="float32")
    values = masked.filled(np.nan).astype(np.float32)
    valid = np.all(~np.ma.getmaskarray(masked), axis=0)
    valid &= np.all(np.isfinite(values) & (values >= 0), axis=0)
    return values, valid


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--modelo", type=Path, required=True)
    parser.add_argument("--imagen-inicial", type=Path, required=True)
    parser.add_argument("--imagen-final", type=Path, required=True)
    parser.add_argument("--fecha-inicial", required=True)
    parser.add_argument("--fecha-final", required=True)
    parser.add_argument("--salida", type=Path, required=True)
    parser.add_argument("--ventana", type=int, default=512,
                        help="Lado de ventana cuadrada en píxeles (64 a 1024)")
    args = parser.parse_args()
    if not 64 <= args.ventana <= 1024:
        parser.error("--ventana debe estar entre 64 y 1024")
    first_date, last_date = date.fromisoformat(args.fecha_inicial), date.fromisoformat(args.fecha_final)
    if first_date >= last_date or args.imagen_inicial.resolve() == args.imagen_final.resolve():
        raise ValueError("Se requieren escenas distintas en orden cronológico")
    validar_fecha_nombre(args.imagen_inicial, first_date)
    validar_fecha_nombre(args.imagen_final, last_date)
    if args.salida.exists():
        raise FileExistsError(f"La carpeta de salida ya existe: {args.salida}")
    bundle = joblib.load(args.modelo)
    contract = bundle.get("contrato")
    if not contract or contract.get("version") != VERSION:
        raise ValueError("El modelo carece de contrato compatible")
    if (contract["columnas_predictoras"] != list(FEATURES) or
            list(bundle["columnas_predictoras"]) != list(FEATURES) or
            contract["bandas_raster_en_orden"] != list(HISTORICAL_BANDS) or
            contract["sha256_dataset_supervisado"] != bundle["reporte"]["sha256_dataset_supervisado"]):
        raise ValueError("El modelo, el contrato y los predictores difieren")
    days = (last_date - first_date).days
    low, high = contract["intervalo_entrenamiento_dias"]
    if not low <= days <= high:
        raise ValueError(f"Intervalo de {days} días fuera del contrato {low}-{high}")
    profile = validar_entrada(args.imagen_inicial, HISTORICAL_BANDS, max_pixeles=None)
    validar_entrada(args.imagen_final, HISTORICAL_BANDS, max_pixeles=None)
    model = bundle["modelo"]
    if list(model.classes_) != [0, 1] or model.n_features_in_ != len(FEATURES):
        raise ValueError("Clasificador incompatible")

    args.salida.mkdir(parents=True)
    score_path = args.salida / "puntaje_cambio_exploratorio.tif"
    class_path = args.salida / "clasificacion_cambio_exploratoria.tif"
    threshold = float(contract["umbral_clasificacion_exploratoria"])
    count_valid = count_positive = 0
    with rasterio.open(args.imagen_inicial) as initial, rasterio.open(args.imagen_final) as final:
        if initial.crs != final.crs:
            raise ValueError("Las escenas tienen CRS distintos; el contrato v9 exige el mismo CRS")
        indexes_initial = [initial.descriptions.index(name) + 1 for name in HISTORICAL_BANDS]
        indexes_final = [final.descriptions.index(name) + 1 for name in HISTORICAL_BANDS]
        vrt_args = dict(crs=initial.crs, transform=initial.transform,
                        width=initial.width, height=initial.height,
                        src_nodata=np.nan, nodata=np.nan)
        with (WarpedVRT(final, resampling=Resampling.bilinear, **vrt_args) as aligned,
              WarpedVRT(final, resampling=Resampling.nearest, **vrt_args) as nearest,
              rasterio.open(score_path, "w", **{**profile, "count": 1, "dtype": "float32",
                                                 "nodata": np.nan, "compress": "deflate",
                                                 "BIGTIFF": "IF_SAFER"}) as score_dst,
              rasterio.open(class_path, "w", **{**profile, "count": 1, "dtype": "uint8",
                                                 "nodata": 255, "compress": "deflate",
                                                 "BIGTIFF": "IF_SAFER"}) as class_dst):
            score_dst.set_band_description(1, "Puntaje de cambio histórico sin calibración")
            class_dst.set_band_description(1, "0=sin cambio, 1=cambio, 255=sin datos")
            for row in range(0, initial.height, args.ventana):
                for col in range(0, initial.width, args.ventana):
                    window = Window(col, row, min(args.ventana, initial.width - col),
                                    min(args.ventana, initial.height - row))
                    before, valid_before = read_window(initial, indexes_initial, window)
                    after, valid_bilinear = read_window(aligned, indexes_final, window)
                    _, valid_nearest = read_window(nearest, indexes_final, window)
                    if (np.any(before[:, valid_before] > 1) or
                            np.any(after[:, valid_bilinear & valid_nearest] > 1)):
                        raise ValueError("La reflectancia excede 1; revisa la escala")
                    matrix, yy, xx = construir_predictores(
                        before, after, valid_before & valid_bilinear & valid_nearest
                    )
                    scores = np.full(valid_before.shape, np.nan, dtype=np.float32)
                    classes = np.full(valid_before.shape, 255, dtype=np.uint8)
                    if len(yy):
                        prediction = model.predict_proba(matrix)[:, 1].astype(np.float32)
                        scores[yy, xx] = prediction
                        classes[yy, xx] = (prediction >= threshold).astype(np.uint8)
                        count_valid += len(yy)
                        count_positive += int(np.count_nonzero(classes == 1))
                    score_dst.write(scores, 1, window=window)
                    class_dst.write(classes, 1, window=window)
    if not count_valid:
        raise ValueError("No hay píxeles válidos comunes")
    report = {
        "caracter": "inferencia_exploratoria_de_cambio_historico_no_riesgo_futuro",
        "modelo": str(args.modelo.resolve()),
        "sha256_dataset_supervisado": contract["sha256_dataset_supervisado"],
        "version_contrato": VERSION,
        "imagen_inicial": str(args.imagen_inicial.resolve()),
        "imagen_final": str(args.imagen_final.resolve()),
        "fecha_inicial": str(first_date), "fecha_final": str(last_date),
        "pixeles_validos": count_valid,
        "pixeles_clase_0": count_valid - count_positive,
        "pixeles_clase_1": count_positive,
        "umbral": threshold,
        "ventana_pixeles": args.ventana,
        "puntaje": "salida RandomForest no calibrada; no equivale a probabilidad de riesgo futuro",
        "limitacion": "Modelo piloto validado solo en tres zonas y con eventos repetidos entre pares",
        "dominio_territorial": evaluar_escena(
            args.imagen_inicial, args.modelo.parent / "dominio_territorial.json",
            contract["sha256_dataset_supervisado"]),
    }
    (args.salida / "reporte_inferencia.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
