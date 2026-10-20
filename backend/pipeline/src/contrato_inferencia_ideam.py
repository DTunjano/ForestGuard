"""Esquema compartido por el entrenamiento piloto y la inferencia temporal."""

from __future__ import annotations

from hashlib import sha256

import numpy as np
import pandas as pd

from calcular_indices_cambios_scl import BANDS as RASTER_BANDS, calculate_indices
from construir_dataset_ml_ideam import BANDS, FEATURES, INDICES


VERSION = "ideam_temporal_piloto_v1"


def crear_contrato(dataset_path):
    """Describe exactamente las entradas que admite el piloto actual."""
    pairs = pd.read_csv(dataset_path, usecols=["id_par", "fecha_inicial", "fecha_final"],
                        encoding="utf-8-sig").drop_duplicates("id_par")
    days = (pd.to_datetime(pairs["fecha_final"]) -
            pd.to_datetime(pairs["fecha_inicial"])).dt.days
    return {
        "version": VERSION,
        "objetivo": "cambio_de_bosque_entre_dos_fechas_sentinel_2",
        "alcance": "clasificacion_historica_exploratoria_no_riesgo_futuro",
        "sha256_dataset_supervisado": sha256(dataset_path.read_bytes()).hexdigest(),
        "bandas_raster_en_orden": list(RASTER_BANDS),
        "bandas_predictoras": list(BANDS),
        "indices": list(INDICES),
        "columnas_predictoras": list(FEATURES),
        "numero_columnas": len(FEATURES),
        "entrada": "dos_GeoTIFF_float32_7_bandas_tras_mascara_SCL",
        "reflectancia": "fraccion_0_a_1_sin_factor_adicional",
        "resolucion_referencia_m": 10,
        "intervalo_entrenamiento_dias": [int(days.min()), int(days.max())],
        "nodata": "NaN",
        "alineacion": "fecha_final_bilineal_y_validez_nearest_a_grilla_inicial",
        "formulas": {
            "NDVI": "(B8-B4)/(B8+B4)",
            "NDMI": "(B8-B11)/(B8+B11)",
            "NBR": "(B8-B12)/(B8+B12)",
            "NDRE": "(B8-B5)/(B8+B5)",
            "diferencias": "indice_t2-indice_t1",
        },
        "umbral_clasificacion_exploratoria": 0.5,
        "codigo_clase_sin_cambio": 0,
        "codigo_clase_cambio": 1,
        "codigo_sin_datos": 255,
    }


def construir_predictores(inicial, final_alineada, mascara_valida):
    """Extrae 26 columnas en el mismo orden que los fragmentos supervisados."""
    indices1 = calculate_indices(inicial)
    indices2 = calculate_indices(final_alineada)
    valid = mascara_valida.copy()
    for name in INDICES:
        valid &= np.isfinite(indices1[name]) & np.isfinite(indices2[name])
    yy, xx = np.where(valid)
    if not len(yy):
        return np.empty((0, len(FEATURES)), dtype=np.float32), yy, xx
    bands1 = {name: initial for name, initial in zip(RASTER_BANDS, inicial)}
    bands2 = {name: ending for name, ending in zip(RASTER_BANDS, final_alineada)}
    columns = {}
    for name in BANDS:
        columns[f"{name}_t1"] = bands1[name][yy, xx]
        columns[f"{name}_t2"] = bands2[name][yy, xx]
    for name in INDICES:
        columns[f"{name}_t1"] = indices1[name][yy, xx]
        columns[f"{name}_t2"] = indices2[name][yy, xx]
        columns[f"d{name}"] = indices2[name][yy, xx] - indices1[name][yy, xx]
    x = np.column_stack([columns[name] for name in FEATURES]).astype(np.float32)
    if not np.isfinite(x).all():
        raise ValueError("Los predictores contienen valores no finitos")
    return x, yy, xx
