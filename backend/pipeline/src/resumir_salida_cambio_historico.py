"""Añade superficies y cobertura a una inferencia histórica ya generada.

Las superficies de clase 1 son áreas señaladas por el piloto, no hectáreas
de deforestación oficial ni probabilidades de riesgo futuro.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import rasterio


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--inferencia", type=Path, required=True)
    args = parser.parse_args()
    folder = args.inferencia
    source_report = json.loads((folder / "reporte_inferencia.json").read_text(encoding="utf-8"))
    destination = folder / "resumen_superficie.json"
    if destination.exists():
        raise FileExistsError(destination)
    with (rasterio.open(folder / "clasificacion_cambio_exploratoria.tif") as classes,
          rasterio.open(folder / "puntaje_cambio_exploratorio.tif") as scores,
          rasterio.open(source_report["imagen_inicial"]) as original):
        grid = (classes.crs, classes.transform, classes.shape)
        if (scores.crs, scores.transform, scores.shape) != grid or (
                original.crs, original.transform, original.shape) != grid:
            raise ValueError("Los rasters de salida e imagen inicial no comparten grilla")
        if classes.crs is None or not classes.crs.is_projected:
            raise ValueError("La superficie requiere un CRS proyectado")
        unit_factor = classes.crs.linear_units_factor[1]
        pixel_m2 = abs(classes.transform.a * classes.transform.e -
                       classes.transform.b * classes.transform.d) * unit_factor**2
        if not 0 < pixel_m2 < 100_000:
            raise ValueError("Área de píxel inesperada")
        counts = {0: 0, 1: 0, 255: 0}
        score_sum = 0.0
        score_min = float("inf")
        score_max = float("-inf")
        for _, window in classes.block_windows(1):
            c = classes.read(1, window=window)
            p = scores.read(1, window=window)
            if not np.isin(c, (0, 1, 255)).all():
                raise ValueError("Clases fuera de 0, 1 y 255")
            valid = c != 255
            if not np.isfinite(p[valid]).all() or np.isfinite(p[~valid]).any():
                raise ValueError("Puntajes y máscara NoData inconsistentes")
            for code in counts:
                counts[code] += int(np.count_nonzero(c == code))
            if valid.any():
                score_sum += float(p[valid].sum(dtype=np.float64))
                score_min = min(score_min, float(np.min(p[valid])))
                score_max = max(score_max, float(np.max(p[valid])))
        total = classes.width * classes.height
    if not counts[0] + counts[1] == source_report["pixeles_validos"]:
        raise ValueError("Conteos diferentes del reporte de inferencia")
    valid_count = counts[0] + counts[1]
    if valid_count == 0:
        raise ValueError("No hay píxeles observados para resumir")
    report = {
        "caracter": "resumen_de_clasificacion_historica_exploratoria",
        "fechas": [source_report["fecha_inicial"], source_report["fecha_final"]],
        "modelo": source_report["modelo"],
        "sha256_dataset_supervisado": source_report["sha256_dataset_supervisado"],
        "umbral": source_report["umbral"],
        "crs": str(grid[0]),
        "area_pixel_m2_proyectada": pixel_m2,
        "pixeles_totales": total,
        "pixeles_validos": valid_count,
        "pixeles_sin_datos": counts[255],
        "fraccion_valida": valid_count / total,
        "area_observada_ha_aprox": valid_count * pixel_m2 / 10_000,
        "pixeles_clase_0": counts[0],
        "pixeles_clase_1": counts[1],
        "area_clase_1_ha_aprox": counts[1] * pixel_m2 / 10_000,
        "fraccion_clase_1_entre_validos": counts[1] / valid_count,
        "puntaje_medio_no_calibrado": score_sum / valid_count,
        "puntaje_minimo": score_min,
        "puntaje_maximo": score_max,
        "interpretacion": "Clase 1 y superficie señalada son patrones de cambio histórico del piloto, no deforestación oficial ni riesgo futuro",
        "limite_territorial": source_report["dominio_territorial"],
    }
    destination.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"salida": str(destination), "area_observada_ha_aprox": report["area_observada_ha_aprox"],
                      "area_clase_1_ha_aprox": report["area_clase_1_ha_aprox"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
