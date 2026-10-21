"""Create downloadable PNG maps and compact visual summaries of an analysis."""

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


def _metric(value):
    return "sin datos" if value is None else f"{value:.3f}"


def _area(value):
    return "sin datos" if value is None else f"{value:.2f} ha"


WIDTH = 1080
BLOCK = 575
TILE_X = (20, 370, 720)
INDEX_SCALES = {
    "NDVI": (.2, .9), "NDMI": (-.2, .6), "NBR": (-.2, .8), "NDRE": (0, .7),
}


def _board(title, note, count):
    canvas = Image.new("RGB", (WIDTH, 110 + count * BLOCK), BACKGROUND)
    draw = ImageDraw.Draw(canvas)
    draw.text((25, 18), title, font=TITLE, fill=INK)
    draw.text((25, 57), note, font=SMALL, fill=MUTED)
    return canvas, draw


def _tile(canvas, draw, column, y, title, map_image, primary="", secondary=""):
    x = TILE_X[column]
    draw.rounded_rectangle((x, y, x + 340, y + 240), radius=10,
                           fill="white", outline="#dbe3e2")
    draw.text((x + 10, y + 8), title, font=LABEL, fill=INK)
    canvas.paste(map_image, (x + 10, y + 36))
    if primary:
        draw.text((x + 10, y + 208), primary, font=SMALL, fill=MUTED)
    if secondary:
        draw.text((x + 10, y + 224), secondary, font=SMALL, fill=MUTED)


def _stat_text(stats):
    return (f"Media {_metric(stats.get('media'))}   "
            f"p10 {_metric(stats.get('p10'))}   p90 {_metric(stats.get('p90'))}")


def _scene_block(canvas, draw, y, scene, path, output):
    date = scene["fecha"]
    draw.text((25, y), f"Fecha {date}", font=LABEL, fill=INK)
    coverage = scene.get("area_observada_ha_aprox")
    valid = scene.get("pixeles_validos")
    draw.text((25, y + 27), f"Área observada: {_area(coverage)}  |  Píxeles válidos: {valid}",
              font=SMALL, fill=MUTED)
    first_row, second_row = y + 55, y + 305
    _tile(canvas, draw, 0, first_row, "Color natural · B4/B3/B2", _rgb_scene(path),
          "Referencia visual de la escena")
    for index, column, row in (("NDVI", 1, first_row), ("NDMI", 2, first_row),
                               ("NBR", 0, second_row), ("NDRE", 1, second_row)):
        low, high = INDEX_SCALES[index]
        raster = output / "fechas" / date / f"{index}.tif"
        image = _index_map(raster, low, high, (227, 190, 76), (32, 117, 59))
        _tile(canvas, draw, column, row, index, image,
              _stat_text(scene["indices"][index]), f"Escala: {low:+.1f} a {high:+.1f} · ocre a verde")
    _tile(canvas, draw, 2, second_row, "Lectura de los índices", _blank("Valor por píxel en cada mapa"),
          "Medias y percentiles de píxeles válidos", "Las manchas requieren revisión")


def _individual_summary(summary, output, normalized_paths):
    scenes = list(zip(summary["escenas"], normalized_paths))
    if not scenes:
        return
    board, draw = _board("ForestGuard | Resultados individuales",
                         "Índices con escalas fijas. Ocre: valor bajo; verde: valor alto. No confirman deforestación.",
                         len(scenes))
    for number, (scene, path) in enumerate(scenes):
        _scene_block(board, draw, 100 + number * BLOCK, scene, path, output)
        single, single_draw = _board("ForestGuard | Resultado individual",
                                     "Índices espectrales y métricas de una fecha.", 1)
        _scene_block(single, single_draw, 100, scene, path, output)
        single.save(output / "fechas" / scene["fecha"] / "resumen_fecha.png", optimize=True)
    board.save(output / "visualizacion_individual.png", optimize=True)


def _interval_block(canvas, draw, y, interval, output):
    first, last = interval["fecha_inicial"], interval["fecha_final"]
    folder = output / "intervalos" / f"{first}_{last}"
    draw.text((25, y), f"Comparación {first} a {last}", font=LABEL, fill=INK)
    days = interval.get("dias")
    common = interval.get("area_comun_ha_aprox")
    draw.text((25, y + 27), f"Intervalo: {days} días  |  Área común: {_area(common)}",
              font=SMALL, fill=MUTED)
    first_row, second_row = y + 55, y + 305
    for index, column, row in (("dNDVI", 0, first_row), ("dNDMI", 1, first_row),
                               ("dNBR", 2, first_row), ("dNDRE", 0, second_row)):
        _tile(canvas, draw, column, row, f"Cambio {index[1:]}",
              _delta_map(folder / f"{index}.tif"), _stat_text(interval["diferencias"][index]),
              "Rojo: descenso · azul: aumento")
    proxy = folder / "indicios_degradacion_observada.tif"
    indication = interval.get("degradacion_observada") or {}
    area = indication.get("area_con_indicios_ha_aprox")
    _tile(canvas, draw, 1, second_row, "Indicio espectral",
          _class_map(proxy, proxy=True) if proxy.is_file() else _blank("Sin máscara SCL"),
          f"Área con indicios: {area:.2f} ha" if area is not None else "Sin área evaluable",
          "Rojo: indicio · ocre: fuera de proxy")
    classification = folder / "clasificacion_piloto" / "clasificacion_cambio_exploratoria.tif"
    surface = (interval.get("superficie") or {}).get("area_clase_1_ha_aprox")
    _tile(canvas, draw, 2, second_row, "Modelo v9 · clase 1",
          _class_map(classification) if classification.is_file() else _blank("Sin clasificación v9"),
          f"Clase 1: {surface:.2f} ha" if surface is not None else "v9 no ejecutado",
          "Clasificación exploratoria")


def _comparative_summary(summary, output):
    intervals = summary["intervalos"]
    if not intervals:
        return
    board, draw = _board("ForestGuard | Cambios entre fechas",
                         "Cambio = fecha final menos inicial. Escala fija ±0,2; señales exploratorias.",
                         len(intervals))
    for number, interval in enumerate(intervals):
        _interval_block(board, draw, 100 + number * BLOCK, interval, output)
        single, single_draw = _board("ForestGuard | Comparación de fechas",
                                     "Mapas de cambio y métricas del intervalo.", 1)
        _interval_block(single, single_draw, 100, interval, output)
        first, last = interval["fecha_inicial"], interval["fecha_final"]
        single.save(output / "intervalos" / f"{first}_{last}" / "resumen_cambio.png",
                    optimize=True)
    board.save(output / "visualizacion_comparativa.png", optimize=True)


def write_visualizations(summary, output, normalized_paths):
    """Persist PNG maps and human-readable summary boards in the result folder."""
    for raster in output.rglob("*.tif"):
        raster.with_suffix(".png").write_bytes(render_preview(raster, max_size=1024))
    _individual_summary(summary, output, normalized_paths)
    _comparative_summary(summary, output)
