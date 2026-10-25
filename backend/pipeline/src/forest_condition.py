"""Versioned project rules; area percentages always use valid pixels as denominator.

Temporal losses use initial minus final. These rules are independent of model v9.
Class 0 deliberately preserves other cover instead of calling every pixel forest.
"""

import numpy as np

VERSION = "forestguard_spectral_rules_v1"
COLORS = {0: "#87939f", 1: "#369b61", 2: "#eab949", 3: "#dc504c"}
LOW_VEGETATION_NDVI = .2
RULES = {
    "ndvi_bosque_proxy_minimo": .5,
    "perdida_ndvi_mayor_que": .3,
    "perdida_nbr_degradacion_minimo": .1,
    "perdida_nbr_degradacion_maximo": .4,
    "convencion_perdida": "inicial_menos_final",
    "prioridad": ["posible_deforestacion", "degradacion", "bosque_estable", "otra_cobertura"],
}


def classify(ndvi, valid, initial_ndvi=None, initial_nbr=None, final_nbr=None):
    forest_threshold = RULES["ndvi_bosque_proxy_minimo"]
    classes = np.full(ndvi.shape, 255, dtype="uint8")
    classes[valid] = 0
    if initial_ndvi is None:
        # A snapshot describes condition; degradation is not inferred without time.
        classes[valid & (ndvi >= forest_threshold)] = 1
        classes[valid & (ndvi >= LOW_VEGETATION_NDVI) & (ndvi < forest_threshold)] = 3
    else:
        forest = valid & (initial_ndvi >= forest_threshold)
        loss_ndvi = initial_ndvi - ndvi
        loss_nbr = initial_nbr - final_nbr
        classes[forest & (ndvi >= forest_threshold)] = 1
        # Indices are float32; tolerate rounding at inclusive boundaries.
        degradation = forest & (loss_nbr >= RULES["perdida_nbr_degradacion_minimo"] - 1e-6)
        degradation &= loss_nbr <= RULES["perdida_nbr_degradacion_maximo"] + 1e-6
        classes[degradation] = 2
        clearing = forest & ((ndvi < forest_threshold) | (loss_ndvi > RULES["perdida_ndvi_mayor_que"] + 1e-6))
        classes[clearing] = 3
    return classes


def condition_summary(counts, total, pixel_area, temporal=False):
    valid = int(sum(counts))
    labels = ("Otra cobertura inicial", "Bosque estable (proxy espectral)",
              "Degradación (señal temporal)", "Posible deforestación") if temporal else (
                  "Otra cobertura / NDVI muy bajo", "Vegetación de vigor alto",
                  "Degradación: requiere otra fecha", "Vegetación de vigor bajo / posible pérdida")
    keys = ("otra_cobertura", "bosque_estable", "degradacion", "posible_deforestacion")
    return {
        "version": VERSION, "tipo": "temporal" if temporal else "condicion_una_fecha",
        "reglas": dict(RULES, **({"ndvi_otra_cobertura_menor_que": LOW_VEGETATION_NDVI} if not temporal else {})),
        "denominador": "pixeles_comunes_validos" if temporal else "pixeles_validos",
        "pixeles_evaluados": valid,
        "porcentaje_cobertura_valida": valid / total * 100 if total else None,
        "area_evaluada_ha": valid * pixel_area / 10000 if pixel_area else None,
        "nota": ("Categorías excluyentes sobre el área común válida. Bosque se aproxima con NDVI inicial ≥ 0,5."
                 if temporal else "Condición en una fecha: NDVI ≥ 0,5 indica vigor alto; 0,2 ≤ NDVI < 0,5 indica vigor bajo; "
                 "NDVI < 0,2 se separa como otra cobertura. La evaluación de pérdida y degradación utiliza dos fechas."),
        "categorias": [{
            "clave": key, "valor": index, "etiqueta": labels[index], "color": COLORS[index],
            "pixeles": int(counts[index]) if temporal or index != 2 else None,
            "porcentaje": (int(counts[index]) / valid * 100 if valid else None)
                          if temporal or index != 2 else None,
            "area_ha": int(counts[index]) * pixel_area / 10000
                       if pixel_area and (temporal or index != 2) else None,
        } for index, key in enumerate(keys)],
    }
