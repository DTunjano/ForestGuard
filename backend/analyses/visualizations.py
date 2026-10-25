"""Create downloadable PNG maps and compact visual summaries of an analysis."""

from contextlib import ExitStack

import numpy as np
import rasterio
from PIL import Image, ImageDraw, ImageFont, ImageOps
from rasterio.enums import Resampling
from rasterio.vrt import WarpedVRT

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


def _sample(path, indexes=(1,), method=Resampling.bilinear, size=PANEL):
    with rasterio.open(path) as src:
        factor = min(1, size[0] / src.width, size[1] / src.height)
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


def _rgb_scene(path, full=False, reference=None):
    with ExitStack() as stack:
        src = stack.enter_context(rasterio.open(path))
        indexes = [src.descriptions.index(band) + 1 for band in ("B4", "B3", "B2")]
        if reference:
            grid = stack.enter_context(rasterio.open(reference))
            src = stack.enter_context(WarpedVRT(src, crs=grid.crs, transform=grid.transform,
                                                width=grid.width, height=grid.height,
                                                src_nodata=np.nan, nodata=np.nan, resampling=Resampling.bilinear))
        size = (1200, 1200) if full else PANEL
        factor = min(1, size[0] / src.width, size[1] / src.height)
        cube = src.read(indexes, out_shape=(3, max(1, round(src.height * factor)), max(1, round(src.width * factor))),
                        masked=True, resampling=Resampling.bilinear)
    values = cube.filled(np.nan)
    rgb = (np.clip(np.nan_to_num(values, nan=0) / .22, 0, 1) ** .75 * 255)
    array = rgb.transpose(1, 2, 0).astype("uint8")
    array[np.ma.getmaskarray(cube).any(axis=0)] = (221, 225, 226)
    image = Image.fromarray(array)
    return image if full else _panel(image)


def _index_map(path, low, high, start, end):
    band = _sample(path)[0]
    values = band.filled(np.nan)
    valid = ~np.ma.getmaskarray(band) & np.isfinite(values)
    fraction = np.clip((np.nan_to_num(values, nan=low) - low) / (high - low), 0, 1)
    array = np.array(start) + (np.array(end) - np.array(start)) * fraction[..., None]
    array = array.astype("uint8")
    array[~valid] = (221, 225, 226)
    return _panel(Image.fromarray(array))


def _index_contrast_map(path, low, high):
    band = _sample(path)[0]
    values = band.filled(np.nan)
    valid = ~np.ma.getmaskarray(band) & np.isfinite(values)
    fraction = np.clip((np.nan_to_num(values, nan=low) - low) / (high - low), 0, 1)
    red = np.array((188, 46, 46))
    neutral = np.array((245, 244, 238))
    blue = np.array((40, 110, 180))
    array = np.where(fraction[..., None] < .5,
                     red + (neutral - red) * (fraction[..., None] * 2),
                     neutral + (blue - neutral) * ((fraction[..., None] - .5) * 2))
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


def _range_chart(items, minimum, maximum, change=False):
    """Show p10-p90 and the mean for each index in a compact panel."""
    image = Image.new("RGB", PANEL, "#f7faf8")
    draw = ImageDraw.Draw(image)
    left, right = 95, 302

    def coordinate(value):
        return left + round((min(max(value, minimum), maximum) - minimum) /
                            (maximum - minimum) * (right - left))

    if change:
        zero = coordinate(0)
        draw.line((zero, 12, zero, 151), fill="#aebec5", width=1)
    for row, (label, stats) in enumerate(items):
        y = 26 + row * 37
        draw.text((10, y - 9), label, font=SMALL, fill=INK)
        draw.line((left, y, right, y), fill="#d3dedd", width=2)
        low, high, mean = (stats.get(key) for key in ("p10", "p90", "media"))
        if None in (low, high, mean):
            continue
        color = "#3b8653" if not change else ("#bd4242" if mean < 0 else "#3279b0")
        draw.line((coordinate(low), y, coordinate(high), y), fill=color, width=5)
        x = coordinate(mean)
        draw.ellipse((x - 5, y - 5, x + 5, y + 5), fill=INK)
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


def _scene_block(canvas, draw, y, scene, path, output, palette="vegetacion"):
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
        image = (_index_contrast_map(raster, low, high) if palette == "contraste"
                 else _index_map(raster, low, high, (227, 190, 76), (32, 117, 59)))
        colors = "rojo bajo · azul alto" if palette == "contraste" else "ocre a verde"
        _tile(canvas, draw, column, row, index, image,
              _stat_text(scene["indices"][index]), f"Escala: {low:+.1f} a {high:+.1f} · {colors}")
    _tile(canvas, draw, 2, second_row, "Distribución de índices",
          _range_chart([(key, scene["indices"][key]) for key in INDEX_SCALES], -1, 1),
          "Barra: p10–p90 · punto: media", "Eje fijo: −1 a +1")


def _individual_summary(summary, output, normalized_paths):
    scenes = list(zip(summary["escenas"], normalized_paths))
    if not scenes:
        return
    for palette in ("vegetacion", "contraste"):
        contrast = palette == "contraste"
        suffix = "_contraste" if contrast else ""
        note = ("Rojo: valor bajo; azul: valor alto. Son valores de una fecha, no cambios temporales."
                if contrast else
                "Índices con escalas fijas. Ocre: valor bajo; verde: valor alto. Condición espectral de cada fecha.")
        board, draw = _board("ForestGuard | Resultados individuales" +
                             (" · contraste" if contrast else ""), note, len(scenes))
        for number, (scene, path) in enumerate(scenes):
            _scene_block(board, draw, 100 + number * BLOCK, scene, path, output, palette)
            single, single_draw = _board("ForestGuard | Resultado individual" +
                                         (" · contraste" if contrast else ""), note, 1)
            _scene_block(single, single_draw, 100, scene, path, output, palette)
            single.save(output / "fechas" / scene["fecha"] / f"resumen_fecha{suffix}.png",
                        optimize=True)
        board.save(output / f"visualizacion_individual{suffix}.png", optimize=True)


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
    if classification.is_file():
        _tile(canvas, draw, 2, second_row, "Modelo v9 · clase 1",
              _class_map(classification),
              f"Clase 1: {surface:.2f} ha" if surface is not None else "Clase 1: sin datos",
              "Clasificación exploratoria")
    else:
        changes = ((key, interval["diferencias"][f"d{key}"]) for key in INDEX_SCALES)
        _tile(canvas, draw, 2, second_row, "Distribución de cambios",
              _range_chart(changes, -.2, .2, change=True),
              "Barra: p10–p90 · punto: media", "v9 no ejecutado en este intervalo")


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
    _condition_boards(summary, output, normalized_paths)


def _condition_boards(summary, output, normalized_paths):
    """Original and categorized result share extent; labels use area percentages."""
    from io import BytesIO

    originals = {}
    paths = {scene["fecha"]: path for scene, path in zip(summary["escenas"], normalized_paths)}
    for scene, path in zip(summary["escenas"], normalized_paths):
        folder = output / "fechas" / scene["fecha"]
        image = _rgb_scene(path, full=True)
        image.save(folder / "original_rgb.png")
        originals[scene["fecha"]] = image
    entries = [(scene, output / "fechas" / scene["fecha"], scene["fecha"],
                originals[scene["fecha"]]) for scene in summary["escenas"]]
    for item in summary["intervalos"]:
        folder = output / "intervalos" / f'{item["fecha_inicial"]}_{item["fecha_final"]}'
        original = _rgb_scene(paths[item["fecha_final"]], full=True, reference=paths[item["fecha_inicial"]])
        original.save(folder / "original_final_rgb.png")
        entries.append((item, folder, f'{item["fecha_inicial"]} a {item["fecha_final"]}', original))
    for item, folder, title, original in entries:
        condition = item.get("condicion")
        if not condition:
            continue
        canvas = Image.new("RGB", (1080, 740), "#f8faf9")
        draw = ImageDraw.Draw(canvas)
        draw.rectangle((0, 0, 1080, 86), fill="#142b31")
        draw.text((25, 14), "ForestGuard | Condición de la cobertura", font=TITLE, fill="white")
        draw.text((25, 52), title, font=LABEL, fill="#bfe1c7")
        draw.text((25, 105), "Imagen original · color natural", font=LABEL, fill=INK)
        draw.text((555, 105), "Resultado · categorías espectrales", font=LABEL, fill=INK)
        categorized = Image.open(BytesIO(render_preview(folder / "condicion_bosque.tif", 1200))).convert("RGBA")
        for x, image in ((25, original), (555, categorized)):
            fitted = ImageOps.contain(image, (500, 370), Image.Resampling.NEAREST)
            canvas.paste(fitted, (x + (500 - fitted.width) // 2, 140 + (370 - fitted.height) // 2),
                         fitted if fitted.mode == "RGBA" else None)
        for row, category in enumerate(condition["categorias"]):
            x, y = (25 if row % 2 == 0 else 555), 530 + (row // 2) * 65
            draw.rounded_rectangle((x, y, x + 500, y + 57), radius=8, fill="white", outline="#dbe3e2")
            draw.ellipse((x + 12, y + 12, x + 25, y + 25), fill=category["color"])
            draw.text((x + 34, y + 5), category["etiqueta"], font=SMALL, fill=INK)
            value = category["porcentaje"]
            text = (f"{value:.2f} % del área válida" if value is not None else
                    "Requiere otra fecha" if condition["tipo"] != "temporal" and category["clave"] == "degradacion"
                    else "Sin área válida")
            draw.text((x + 34, y + 29), text, font=SMALL, fill=MUTED)
        coverage = condition.get("porcentaje_cobertura_valida")
        coverage_text = f"{coverage:.2f} %" if coverage is not None else "sin datos"
        draw.text((25, 676), f"Cobertura válida: {coverage_text} | Categorías excluyentes · método {condition['version']}",
                  font=SMALL, fill=MUTED)
        draw.text((25, 705), "Gris: otra cobertura. Transparente: sin datos. Porcentajes calculados sobre píxeles válidos.",
                  font=SMALL, fill=MUTED)
        # The report already supplies the date and branding; omit the duplicated
        # banner so the v9 statistics fit with the maps on the same page.
        canvas.crop((0, 86, 1080, 515)).save(folder / "mapas_original_resultado.png", optimize=True)
        canvas.save(folder / "resumen_condicion.png", optimize=True)
