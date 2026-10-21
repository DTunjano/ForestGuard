"""Create downloadable PNG maps and compact visual summaries of an analysis."""

from math import ceil

import numpy as np
import rasterio
from PIL import Image, ImageDraw, ImageFont, ImageOps
from rasterio.enums import Resampling

from .raster_preview import render_preview

PANEL = (320, 170)
BACKGROUND = "#f8faf9"
INK = "#172c39"
MUTED = "#465c69"


def _font(size):
    for name in ("DejaVuSans.ttf", "C:/Windows/Fonts/arial.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


TITLE = _font(26)
LABEL = _font(18)
SMALL = _font(15)


def _sample(path, indexes=(1,), method=Resampling.bilinear):
    with rasterio.open(path) as src:
        factor = min(1, PANEL[0] / src.width, PANEL[1] / src.height)
        width, height = max(1, round(src.width * factor)), max(1, round(src.height * factor))
        return src.read(indexes, out_shape=(len(indexes), height, width),
                        masked=True, resampling=method)


def _panel(image):
    fitted = ImageOps.contain(image, PANEL, Image.Resampling.NEAREST)
    panel = Image.new("RGB", PANEL, "#eff2ef")
    if fitted.mode == "RGBA":
        panel.paste(fitted, ((PANEL[0] - fitted.width) // 2,
                             (PANEL[1] - fitted.height) // 2), fitted)
    else:
        panel.paste(fitted, ((PANEL[0] - fitted.width) // 2,
                             (PANEL[1] - fitted.height) // 2))
    return panel


def _rgb_scene(path):
    with rasterio.open(path) as src:
        indexes = [src.descriptions.index(band) + 1 for band in ("B4", "B3", "B2")]
    cube = _sample(path, indexes)
    values = cube.filled(np.nan)
    rgb = (np.clip(np.nan_to_num(values, nan=0) / .22, 0, 1) ** .75 * 255)
    array = rgb.transpose(1, 2, 0).astype("uint8")
    array[np.ma.getmaskarray(cube).any(axis=0)] = (221, 225, 226)
    return _panel(Image.fromarray(array))


def _index_map(path, low, high, start, end):
    band = _sample(path)[0]
    values = band.filled(np.nan)
    valid = ~np.ma.getmaskarray(band) & np.isfinite(values)
    fraction = np.clip((np.nan_to_num(values, nan=low) - low) / (high - low), 0, 1)
    array = np.array(start) + (np.array(end) - np.array(start)) * fraction[..., None]
    array = array.astype("uint8")
    array[~valid] = (221, 225, 226)
    return _panel(Image.fromarray(array))


def _delta_map(path):
    band = _sample(path)[0]
    values = band.filled(np.nan)
    valid = ~np.ma.getmaskarray(band) & np.isfinite(values)
    fraction = np.clip(np.nan_to_num(values, nan=0) / .2, -1, 1)
    neutral = np.array((245, 244, 238))
    red = np.array((188, 46, 46))
    blue = np.array((40, 110, 180))
    array = np.where(fraction[..., None] < 0,
                     neutral + (red - neutral) * -fraction[..., None],
                     neutral + (blue - neutral) * fraction[..., None]).astype("uint8")
    array[~valid] = (221, 225, 226)
    return _panel(Image.fromarray(array))


def _class_map(path, proxy=False):
    band = _sample(path, method=Resampling.nearest)[0]
    values = band.filled(255)
    array = np.full((*values.shape, 3), (245, 244, 238), dtype="uint8")
    array[values == 1] = (194, 49, 49)
    if proxy:
        array[values == 2] = (219, 179, 94)
    array[values == 255] = (221, 225, 226)
    return _panel(Image.fromarray(array))


def _blank(message):
    image = Image.new("RGB", PANEL, "#eff2ef")
    ImageDraw.Draw(image).text((15, 70), message, font=SMALL, fill=MUTED)
    return image


def _canvas(cards, title, note, card_height):
    columns = min(4, max(1, len(cards)))
    rows = ceil(len(cards) / columns)
    card_width, gap, left, top = 350, 15, 28, 115
    canvas = Image.new("RGB", (max(1100, left * 2 + columns * card_width + (columns - 1) * gap),
                               top + rows * card_height + 38), BACKGROUND)
    draw = ImageDraw.Draw(canvas)
    draw.text((left, 22), title, font=TITLE, fill=INK)
    draw.text((left, 65), note, font=SMALL, fill=MUTED)
    for index, card in enumerate(cards):
        x = left + (index % columns) * (card_width + gap)
        y = top + (index // columns) * card_height
        card(canvas, draw, x, y)
    return canvas


def _metric(value):
    return "sin datos" if value is None else f"{value:.3f}"


def _individual_summary(summary, output, normalized_paths):
    cards = []
    for scene, path in zip(summary["escenas"], normalized_paths):
        date = scene["fecha"]
        ndvi = output / "fechas" / date / "NDVI.tif"

        def card(canvas, draw, x, y, scene=scene, path=path, ndvi=ndvi):
            draw.text((x, y), scene["fecha"], font=LABEL, fill=INK)
            draw.text((x, y + 31), "Color natural B4/B3/B2", font=SMALL, fill=MUTED)
            canvas.paste(_rgb_scene(path), (x, y + 55))
            draw.text((x, y + 231), "NDVI", font=SMALL, fill=MUTED)
            canvas.paste(_index_map(ndvi, .3, .9, (227, 190, 76), (32, 117, 59)),
                         (x, y + 252))
            indices = scene["indices"]
            draw.text((x, y + 427),
                      "NDVI " + _metric(indices["NDVI"]["media"]) +
                      "   NDMI " + _metric(indices["NDMI"]["media"]),
                      font=SMALL, fill=MUTED)
            draw.text((x, y + 449),
                      "NBR " + _metric(indices["NBR"]["media"]) +
                      "   NDRE " + _metric(indices["NDRE"]["media"]),
                      font=SMALL, fill=MUTED)

        cards.append(card)
    if cards:
        image = _canvas(cards, "ForestGuard | Análisis individual por fecha",
                        "Color natural y NDVI (escala fija 0,30 a 0,90). Los índices no confirman deforestación.",
                        495)
        image.save(output / "visualizacion_individual.png", optimize=True)


def _comparative_summary(summary, output):
    cards = []
    for interval in summary["intervalos"]:
        first, last = interval["fecha_inicial"], interval["fecha_final"]
        folder = output / "intervalos" / f"{first}_{last}"

        def card(canvas, draw, x, y, interval=interval, folder=folder):
            draw.text((x, y), interval["fecha_inicial"], font=LABEL, fill=INK)
            draw.text((x, y + 25), "a " + interval["fecha_final"], font=LABEL, fill=INK)
            draw.text((x, y + 58),
                      "Cambio NDVI medio " + _metric(interval["diferencias"]["dNDVI"]["media"]),
                      font=SMALL, fill=MUTED)
            canvas.paste(_delta_map(folder / "dNDVI.tif"), (x, y + 82))
            draw.text((x, y + 259), "Indicio espectral", font=SMALL, fill=MUTED)
            proxy = folder / "indicios_degradacion_observada.tif"
            canvas.paste(_class_map(proxy, proxy=True) if proxy.is_file()
                         else _blank("Sin máscara SCL"), (x, y + 282))
            area = interval["degradacion_observada"]["area_con_indicios_ha_aprox"]
            if area is not None:
                draw.text((x, y + 456), f"Área con indicios: {area:.2f} ha", font=SMALL, fill=MUTED)
            draw.text((x, y + 481), "Modelo v9: clase 1", font=SMALL, fill=MUTED)
            classification = folder / "clasificacion_piloto" / "clasificacion_cambio_exploratoria.tif"
            canvas.paste(_class_map(classification) if classification.is_file()
                         else _blank("Sin clasificación v9"), (x, y + 504))
            if interval.get("estado_clasificacion") == "ejecutada":
                area = interval["superficie"]["area_clase_1_ha_aprox"]
                draw.text((x, y + 680), f"Clase 1: {area:.2f} ha", font=SMALL, fill=MUTED)
            else:
                draw.text((x, y + 680), "v9 no ejecutado", font=SMALL, fill=MUTED)

        cards.append(card)
    if cards:
        image = _canvas(cards, "ForestGuard | Comparación entre fechas",
                        "Rojo: descenso de NDVI o clase 1. Señales exploratorias; verificar nubes y cobertura.",
                        720)
        image.save(output / "visualizacion_comparativa.png", optimize=True)


def write_visualizations(summary, output, normalized_paths):
    """Persist PNG maps and human-readable summary boards in the result folder."""
    for raster in output.rglob("*.tif"):
        raster.with_suffix(".png").write_bytes(render_preview(raster, max_size=1024))
    _individual_summary(summary, output, normalized_paths)
    _comparative_summary(summary, output)
