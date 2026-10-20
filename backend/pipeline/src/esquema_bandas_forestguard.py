"""Adapta el orden canónico nuevo al orden histórico del piloto v9 en memoria."""

from __future__ import annotations

import numpy as np
import rasterio

from calcular_indices_cambios_scl import BANDS as HISTORICAL_BANDS


CANONICAL_BANDS = ["B2", "B3", "B4", "B5", "B8", "B11", "B12"]
ACCEPTED_ORDERS = (tuple(CANONICAL_BANDS), tuple(HISTORICAL_BANDS))


def load_compatible_stack(path):
    """Lee ambos esquemas y entrega el orden histórico esperado por los índices.

    No altera el raster ni el orden de las características entrenadas.
    """
    with rasterio.open(path) as src:
        descriptions = tuple(src.descriptions)
        if src.count != 7 or descriptions not in ACCEPTED_ORDERS:
            raise ValueError(
                f"Orden de bandas incompatible en {path}: {descriptions}; "
                f"se admite {ACCEPTED_ORDERS}"
            )
        indexes = [descriptions.index(name) + 1 for name in HISTORICAL_BANDS]
        arr = src.read(indexes, masked=True, out_dtype="float32")
        values = arr.filled(np.nan).astype(np.float32)
        valid = np.all(~np.ma.getmaskarray(arr), axis=0)
        valid &= np.all(np.isfinite(values) & (values >= 0), axis=0)
        meta = {
            "profile": src.profile.copy(),
            "transform": src.transform,
            "crs": src.crs,
            "width": src.width,
            "height": src.height,
            "bounds": src.bounds,
        }
        return values, valid, meta
