"""Cheap, bounded eligibility checks shared by uploads and the portable pipeline."""

from contextlib import ExitStack

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.vrt import WarpedVRT
from rasterio.windows import Window

MIN_VALID_FRACTION = 0.60
QUALITY_VERSION = "forestguard_pixel_quality_v1"
SPECTRAL_BANDS = ("B2", "B3", "B4", "B5", "B8", "B11", "B12")


def windows(source, side=512):
    for row in range(0, source.height, side):
        for col in range(0, source.width, side):
            yield Window(col, row, min(side, source.width - col), min(side, source.height - row))


def valid_mask(source, mapping, window, scale="fraction", scl_factor=None):
    raw = source.read(
        [mapping[name] for name in SPECTRAL_BANDS], window=window, masked=True, out_dtype="float32"
    )
    cube = raw.filled(np.nan)
    if scale == "divide_10000":
        cube /= 10000.0
    valid = np.all(~np.ma.getmaskarray(raw), axis=0)
    valid &= np.all(np.isfinite(cube) & (cube >= 0) & (cube <= 1), axis=0)
    bands = dict(zip(SPECTRAL_BANDS, cube))
    # The same nonzero denominators used for NDVI, NDMI, NBR and NDRE.
    for band in ("B4", "B11", "B12", "B5"):
        valid &= np.abs(bands["B8"] + bands[band]) > 1e-10
    if "SCL" in mapping:
        raw_scl = source.read(mapping["SCL"], window=window, masked=True, out_dtype="float32")
        values = raw_scl.filled(np.nan) * scl_factor
        rounded = np.rint(np.nan_to_num(values, nan=0)).astype("int16")
        valid &= ~np.ma.getmaskarray(raw_scl) & np.isfinite(values)
        valid &= (np.abs(values - rounded) <= 0.05) & np.isin(rounded, (4, 5))
    return valid


def scan_coverage(source, descriptions=None, scale="fraction", scl_factor=None):
    mapping = {
        name: index for index, name in enumerate(descriptions or source.descriptions, 1) if name
    }
    count = sum(
        int(valid_mask(source, mapping, window, scale, scl_factor).sum())
        for window in windows(source)
    )
    return {
        "valid_pixels": count,
        "total_pixels": source.width * source.height,
        "valid_fraction": count / (source.width * source.height),
        "version": QUALITY_VERSION,
    }


def require_coverage(quality, label="Imagen"):
    if quality["valid_fraction"] < MIN_VALID_FRACTION:
        raise ValueError(
            f"{label}: cobertura válida {quality['valid_fraction'] * 100:.2f} % "
            f"({quality['valid_pixels']} de {quality['total_pixels']} píxeles válidos). "
            "Se requiere al menos 60 %. El análisis no se realizará."
        )


def normalized_coverage(path):
    with rasterio.open(path) as source:
        quality = scan_coverage(source)
    require_coverage(quality, path.name)
    return quality


def normalized_pair_coverage(first, second):
    """Check the common valid fraction on the initial grid, before index/model outputs."""
    with ExitStack() as stack:
        initial = stack.enter_context(rasterio.open(first))
        final = stack.enter_context(rasterio.open(second))
        args = dict(
            crs=initial.crs,
            transform=initial.transform,
            width=initial.width,
            height=initial.height,
            src_nodata=np.nan,
            nodata=np.nan,
        )
        bilinear = stack.enter_context(WarpedVRT(final, resampling=Resampling.bilinear, **args))
        nearest = stack.enter_context(WarpedVRT(final, resampling=Resampling.nearest, **args))
        before = {name: i for i, name in enumerate(initial.descriptions, 1)}
        after = {name: i for i, name in enumerate(final.descriptions, 1)}
        count = 0
        for window in windows(initial):
            valid = valid_mask(initial, before, window) & valid_mask(bilinear, after, window)
            valid &= valid_mask(nearest, after, window)
            count += int(valid.sum())
        total = initial.width * initial.height
    quality = {
        "valid_pixels": count,
        "total_pixels": total,
        "valid_fraction": count / total,
        "version": QUALITY_VERSION,
    }
    require_coverage(quality, "Área común de la comparación")
    return quality
