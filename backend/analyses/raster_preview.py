"""Small, bounded PNG previews of completed analysis rasters."""

from base64 import b64encode
from io import BytesIO

import numpy as np
import rasterio
from PIL import Image
from rasterio.enums import Resampling
from rasterio.warp import transform_bounds

CLASS_STYLES = {
    "condicion_bosque.tif": {
        "0": (135, 147, 159, 255), "1": (54, 155, 97, 255),
        "2": (234, 185, 73, 255), "3": (220, 80, 76, 255),
    },
    "clasificacion_cambio_exploratoria.tif": {
        "0": (56, 161, 105, 255), "1": (231, 76, 60, 255),
    },
    "indicios_degradacion_observada.tif": {
        "0": (56, 161, 105, 255), "1": (245, 158, 11, 255),
        "2": (120, 135, 147, 255),
    },
}
CLASS_LABELS = {
    "condicion_bosque.tif": {
        "0": "Otra cobertura", "1": "Vigor alto / bosque estable (proxy)",
        "2": "Degradación temporal", "3": "Vigor bajo / posible pérdida",
    },
    "clasificacion_cambio_exploratoria.tif": {
        "0": "Sin cambio según modelo", "1": "Cambio histórico exploratorio",
    },
    "indicios_degradacion_observada.tif": {
        "0": "Sin indicios según regla", "1": "Indicios espectrales",
        "2": "Fuera de vegetación remanente",
    },
}

# The interactive layers use the same fixed scales as the downloadable boards.
INDEX_SCALES = {"NDVI": (.2, .9), "NDMI": (-.2, .6), "NBR": (-.2, .8), "NDRE": (0., .7)}


def _grid(source):
    return {"width": source.width, "height": source.height, "crs": str(source.crs),
            "transform": list(source.transform)[:6]}


def category_mask(path, max_size=768):
    """Bounded nearest-neighbour class IDs, independent of PNG palettes/colors."""
    with rasterio.open(path) as source:
        factor = min(1., max_size / max(source.width, source.height))
        width, height = max(1, round(source.width * factor)), max(1, round(source.height * factor))
        band = source.read(1, out_shape=(height, width), masked=True, resampling=Resampling.nearest)
        values = band.filled(255).astype("uint8")
        values[~np.isin(values, (0, 1, 2, 3))] = 255
        return {"width": width, "height": height, "grid": _grid(source),
                "encoding": "uint8-base64", "nodata": 255,
                "values": b64encode(values.tobytes()).decode("ascii")}


def raster_style(filename, palette="default"):
    if filename in CLASS_STYLES:
        return {"type": "classes", "legend": [
            {"value": int(value), "label": CLASS_LABELS[filename][value], "color": _hex(color)}
            for value, color in CLASS_STYLES[filename].items()
        ]}
    index = filename.removesuffix(".tif")
    if palette == "contrast" and (index in INDEX_SCALES or index.removeprefix("d") in INDEX_SCALES):
        temporal = index.startswith("d")
        minimum, maximum = (-.2, .2) if temporal else INDEX_SCALES[index]
        return {"type": "continuous", "minimum": minimum, "maximum": maximum,
                "label": "Cambio: fecha final menos inicial" if temporal else "Valor del índice en esta fecha",
                "colors": ["#bc2e2e", "#f5f4ee", "#286eb4"],
                "low_label": "Descenso" if temporal else "Valor bajo",
                "high_label": "Aumento" if temporal else "Valor alto"}
    if filename == "puntaje_cambio_exploratorio.tif":
        minimum, maximum, label = 0.0, 1.0, "Puntaje exploratorio sin calibración"
    elif filename.startswith("d") or filename == "tendencia_ndvi_por_anio.tif":
        minimum, maximum, label = -1.0, 1.0, "Cambio espectral"
    else:
        minimum, maximum, label = -1.0, 1.0, "Índice espectral"
    return {"type": "continuous", "minimum": minimum, "maximum": maximum, "label": label,
            "colors": ["#d9534f", "#f4d35e", "#2ca25f"]}


def _hex(color):
    return "#" + "".join(f"{channel:02x}" for channel in color[:3])


def raster_metadata(path, palette="default"):
    with rasterio.open(path) as source:
        return {
            "width": source.width, "height": source.height, "crs": str(source.crs),
            "bounds_wgs84": list(transform_bounds(source.crs, "EPSG:4326", *source.bounds)),
            "band_description": source.descriptions[0],
            "style": raster_style(path.name, palette), "grid": _grid(source),
        }


def render_preview(path, max_size=768, palette="default"):
    with rasterio.open(path) as source:
        scale = min(1.0, max_size / max(source.width, source.height))
        width = max(1, round(source.width * scale))
        height = max(1, round(source.height * scale))
        style = raster_style(path.name, palette)
        method = Resampling.nearest if style["type"] == "classes" else Resampling.bilinear
        values = source.read(1, out_shape=(height, width), masked=True, resampling=method)
    data = values.astype("float32").filled(np.nan)
    valid = ~np.ma.getmaskarray(values) & np.isfinite(data)
    rgba = np.zeros((height, width, 4), dtype=np.uint8)
    if style["type"] == "classes":
        for value, color in CLASS_STYLES[path.name].items():
            rgba[valid & (data == int(value))] = color
    else:
        normalized = np.clip((data - style["minimum"]) /
                             (style["maximum"] - style["minimum"]), 0, 1)
        low, middle, high = (np.array(tuple(bytes.fromhex(color[1:])), dtype=np.float32)
                             for color in style["colors"])
        lower = normalized <= 0.5
        factor = np.where(lower, normalized * 2, (normalized - 0.5) * 2)
        rgb = np.where(lower[..., None],
                       low + (middle - low) * factor[..., None],
                       middle + (high - middle) * factor[..., None])
        rgba[..., :3] = np.nan_to_num(rgb).astype(np.uint8)
        rgba[..., 3] = np.where(valid, 255, 0)
    output = BytesIO()
    Image.fromarray(rgba).save(output, format="PNG")
    return output.getvalue()
