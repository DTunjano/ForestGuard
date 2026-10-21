"""Derive acquisition metadata from a Sentinel-2 GeoTIFF without user switches."""

import re
from datetime import date
from pathlib import Path

import numpy as np
from rasterio.windows import Window
from rest_framework import serializers


DATE_TAGS = ("acquisition_date", "date_acquired", "sensing_time", "sensing_date",
             "datatake_sensing_start", "acquisition_time")
SPECTRAL_BANDS = ("B2", "B3", "B4", "B5", "B8", "B11", "B12")


def _parse_date(raw):
    value = str(raw).strip()
    match = re.match(r"^(20\d{2})[-_]?([01]\d)[-_]?([0-3]\d)(?:T|$|\D)", value)
    if not match:
        return None
    try:
        return date(*map(int, match.groups()))
    except ValueError:
        return None


def acquisition_date(filename, src):
    """Prefer explicit acquisition tags; reject conflicting or absent dates."""
    tags = {key.lower(): value for key, value in src.tags().items()}
    tagged = {_parse_date(tags[key]) for key in DATE_TAGS if key in tags}
    tagged.discard(None)
    if len(tagged) > 1:
        raise serializers.ValidationError({"file": "El GeoTIFF declara fechas de adquisición contradictorias."})
    stem = Path(filename).stem
    separated = re.findall(r"(?<!\d)20\d{2}[-_][01]\d[-_][0-3]\d(?!\d)", stem)
    sentinel = re.findall(r"(?<!\d)20\d{6}T\d{6}(?!\d)", stem)
    parsed = {_parse_date(value) for value in separated + sentinel}
    parsed.discard(None)
    if tagged:
        tagged_date = tagged.pop()
        if parsed and parsed != {tagged_date}:
            raise serializers.ValidationError({"file": "La fecha de adquisición del GeoTIFF contradice la del nombre del archivo."})
        return tagged_date
    if len(parsed) == 1:
        return parsed.pop()
    raise serializers.ValidationError({"file": (
        "No se pudo determinar una fecha de adquisición única. Use un GeoTIFF con metadatos "
        "de adquisición o un nombre que incluya AAAA_MM_DD, AAAA-MM-DD o AAAAMMDDThhmmss."
    )})


def _sample_windows(src):
    side = 256
    rows = sorted({0, max(0, (src.height - side) // 2), max(0, src.height - side)})
    cols = sorted({0, max(0, (src.width - side) // 2), max(0, src.width - side)})
    for row in rows:
        for col in cols:
            yield Window(col, row, min(side, src.width - col), min(side, src.height - row))


def raster_scales(src, descriptions):
    """Use radiometry and SCL class codes; fail when a factor cannot be inferred."""
    bands = {name: index for index, name in enumerate(descriptions, 1) if name}
    spectral = []
    scl = []
    for window in _sample_windows(src):
        cube = src.read([bands[name] for name in SPECTRAL_BANDS], window=window,
                        masked=True, out_dtype="float32")
        values = cube.compressed()
        values = values[np.isfinite(values) & (values > 0)]
        if values.size:
            spectral.append(values[::max(1, values.size // 20000)])
        if "SCL" in bands:
            classes = src.read(bands["SCL"], window=window, masked=True,
                               out_dtype="float32").compressed()
            classes = classes[np.isfinite(classes) & (classes > 0)]
            if classes.size:
                scl.append(classes[::max(1, classes.size // 20000)])

    if not spectral:
        raise serializers.ValidationError({"file": "No se pudo inferir la escala: las bandas muestreadas no contienen reflectancia positiva."})
    spectral_values = np.concatenate(spectral)
    p95 = float(np.percentile(spectral_values, 95))
    if p95 <= 1:
        reflectance_scale = "fraction"
    elif p95 <= 10000:
        reflectance_scale = "divide_10000"
    else:
        raise serializers.ValidationError({"file": "La reflectancia no corresponde a escala fraccionaria ni a valores divididos entre 10000."})

    if "SCL" not in bands:
        return reflectance_scale, None
    if not scl:
        raise serializers.ValidationError({"file": "No se pudo inferir el factor SCL: no hay clases positivas en la muestra."})
    scl_values = np.concatenate(scl)
    candidates = []
    for factor in (1, 10000):
        scaled = scl_values * factor
        rounded = np.rint(scaled)
        plausible = (np.abs(scaled - rounded) <= .05) & (rounded >= 1) & (rounded <= 11)
        if float(np.mean(plausible)) >= .95:
            candidates.append(factor)
    if len(candidates) != 1:
        raise serializers.ValidationError({"file": "No se pudo inferir de forma segura el factor SCL (1 o 10000)."})
    return reflectance_scale, candidates[0]
