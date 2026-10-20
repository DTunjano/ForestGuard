"""Genera mapas exploratorios de cambio histórico con dos escenas estandarizadas.

La salida es una clasificación del piloto y un puntaje sin calibración. No
representa riesgo futuro ni confirma por sí sola deforestación.
"""

from __future__ import annotations

import argparse
from datetime import date
import json
from pathlib import Path
import re

import joblib
import numpy as np
import rasterio

from calcular_indices_cambios_scl import align_final_to_initial
from contrato_inferencia_ideam import VERSION, construir_predictores
from construir_dataset_ml_ideam import FEATURES
from dominio_territorial_ideam import evaluar_escena
from esquema_bandas_forestguard import ACCEPTED_ORDERS, HISTORICAL_BANDS, load_compatible_stack


def validar_entrada(path, bandas, requiere_scl=True, max_pixeles=5_000_000):
    if path.suffix.lower() not in (".tif", ".tiff"):
        raise ValueError(f"Se requiere GeoTIFF estandarizado: {path}")
    with rasterio.open(path) as src:
        if src.count != len(bandas) or tuple(src.descriptions) not in ACCEPTED_ORDERS:
            raise ValueError(f"Bandas u orden incompatibles en {path}: {src.descriptions}")
        if any(kind != "float32" for kind in src.dtypes):
            raise ValueError(f"Se requieren siete bandas float32 en {path}")
        if src.nodata is None or not np.isnan(src.nodata):
            raise ValueError(f"Se requiere NoData=NaN en {path}")
        if any(scale != 1 for scale in src.scales) or any(offset != 0 for offset in src.offsets):
            raise ValueError(f"Escala o desplazamiento raster inesperado en {path}")
        if src.crs is None:
            raise ValueError(f"Falta CRS en {path}")
        processing = src.tags().get("processing", "")
        if not processing.startswith("Copia estandarizada"):
            raise ValueError(f"La escena no acredita el preprocesamiento SCL: {path}")
        if requiere_scl and ("tras" not in processing or not src.crs.is_projected or
                             abs(src.crs.linear_units_factor[1] - 1) >= 1e-9 or
                             any(abs(value - 10) >= 0.01 for value in src.res)):
            raise ValueError(f"El modelo requiere máscara SCL, CRS en metros y resolución de 10 m: {path}")
        if max_pixeles is not None and src.width * src.height > max_pixeles:
            raise ValueError("La versión piloto admite hasta cinco millones de píxeles por escena")
        return src.profile.copy()


def validar_fecha_nombre(path, fecha):
    """Si el nombre incluye fechas, impide contradecirlas con la CLI."""
    fechas = re.findall(r"(?<!\d)20\d{2}[_-]\d{2}[_-]\d{2}(?!\d)", path.stem)
    if fechas and fecha.strftime("%Y_%m_%d") not in [value.replace("-", "_") for value in fechas]:
        raise ValueError(f"La fecha declarada {fecha} no aparece en el nombre de {path}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--modelo", type=Path, required=True)
    parser.add_argument("--imagen-inicial", type=Path, required=True)
    parser.add_argument("--imagen-final", type=Path, required=True)
    parser.add_argument("--fecha-inicial", required=True)
    parser.add_argument("--fecha-final", required=True)
    parser.add_argument("--salida", type=Path, required=True,
                        help="Carpeta nueva para dos GeoTIFF y un reporte JSON")
    args = parser.parse_args()
    first_date, last_date = date.fromisoformat(args.fecha_inicial), date.fromisoformat(args.fecha_final)
    if first_date >= last_date:
        raise ValueError("La fecha inicial debe preceder a la final")
    if args.imagen_inicial.resolve() == args.imagen_final.resolve():
        raise ValueError("Las dos fechas requieren escenas distintas")
    validar_fecha_nombre(args.imagen_inicial, first_date)
    validar_fecha_nombre(args.imagen_final, last_date)
    if args.salida.exists():
        raise FileExistsError(f"La carpeta de salida ya existe: {args.salida}")
    bundle = joblib.load(args.modelo)
    contract = bundle.get("contrato")
    if not contract or contract.get("version") != VERSION:
        raise ValueError("El modelo no incluye el contrato temporal compatible")
    if list(bundle["columnas_predictoras"]) != list(FEATURES):
        raise ValueError("Las columnas del modelo difieren del pipeline actual")
    if contract["columnas_predictoras"] != list(FEATURES):
        raise ValueError("El contrato tiene un orden de predictores incompatible")
    if contract["bandas_raster_en_orden"] != list(HISTORICAL_BANDS):
        raise ValueError("El contrato del modelo no coincide con el orden histórico de cálculo")
    if contract["sha256_dataset_supervisado"] != bundle["reporte"]["sha256_dataset_supervisado"]:
        raise ValueError("El contrato no corresponde al dataset del modelo")
    days = (last_date - first_date).days
    low, high = contract["intervalo_entrenamiento_dias"]
    if not low <= days <= high:
        raise ValueError(f"El intervalo de {days} días queda fuera de los {low}-{high} días del piloto")
    profile = validar_entrada(args.imagen_inicial, contract["bandas_raster_en_orden"])
    validar_entrada(args.imagen_final, contract["bandas_raster_en_orden"])
    initial, valid_initial, meta_initial = load_compatible_stack(args.imagen_inicial)
    final, valid_final, meta_final = load_compatible_stack(args.imagen_final)
    if meta_initial["crs"] != meta_final["crs"]:
        raise ValueError("Las escenas tienen CRS distintos; esta versión requiere el mismo CRS")
    for name, array, mask in (("inicial", initial, valid_initial), ("final", final, valid_final)):
        if np.any(array[:, mask] > 1):
            raise ValueError(f"La reflectancia {name} excede 1; revisa la escala")
    aligned, valid_aligned = align_final_to_initial(final, valid_final, meta_final, meta_initial)
    matrix, yy, xx = construir_predictores(initial, aligned, valid_initial & valid_aligned)
    if not len(yy):
        raise ValueError("No hay píxeles válidos comunes tras alinear ambas fechas")
    model = bundle["modelo"]
    if list(model.classes_) != [0, 1] or model.n_features_in_ != len(FEATURES):
        raise ValueError("El clasificador no coincide con las dos clases y 26 predictores")
    score = model.predict_proba(matrix)[:, 1].astype(np.float32)
    threshold = float(contract["umbral_clasificacion_exploratoria"])
    score_map = np.full(valid_initial.shape, np.nan, dtype=np.float32)
    class_map = np.full(valid_initial.shape, 255, dtype=np.uint8)
    score_map[yy, xx] = score
    class_map[yy, xx] = (score >= threshold).astype(np.uint8)
    args.salida.mkdir(parents=True)
    score_path = args.salida / "puntaje_cambio_exploratorio.tif"
    class_path = args.salida / "clasificacion_cambio_exploratoria.tif"
    with rasterio.open(score_path, "w", **{**profile, "count": 1, "dtype": "float32",
                                           "nodata": np.nan, "compress": "deflate"}) as dst:
        dst.write(score_map, 1)
        dst.set_band_description(1, "Puntaje de cambio histórico sin calibración")
    with rasterio.open(class_path, "w", **{**profile, "count": 1, "dtype": "uint8",
                                           "nodata": 255, "compress": "deflate"}) as dst:
        dst.write(class_map, 1)
        dst.set_band_description(1, "0=sin cambio, 1=cambio, 255=sin datos")
    report = {
        "caracter": "inferencia_exploratoria_de_cambio_historico_no_riesgo_futuro",
        "modelo": str(args.modelo.resolve()),
        "sha256_dataset_supervisado": contract["sha256_dataset_supervisado"],
        "version_contrato": VERSION,
        "imagen_inicial": str(args.imagen_inicial.resolve()),
        "imagen_final": str(args.imagen_final.resolve()),
        "fecha_inicial": str(first_date),
        "fecha_final": str(last_date),
        "pixeles_validos": int(len(yy)),
        "pixeles_clase_0": int((class_map == 0).sum()),
        "pixeles_clase_1": int((class_map == 1).sum()),
        "umbral": threshold,
        "puntaje": "salida RandomForest no calibrada; no equivale a probabilidad de riesgo futuro",
        "limitacion": "Modelo piloto validado solo en tres zonas y con eventos repetidos entre pares",
        "dominio_territorial": evaluar_escena(
            args.imagen_inicial, args.modelo.parent / "dominio_territorial.json",
            contract["sha256_dataset_supervisado"]),
    }
    (args.salida / "reporte_inferencia.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
