"""Ordered PNG plates shared by report generation and report checks."""

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ReportPlate:
    path: Path
    relative_path: str
    section: str
    period: str
    title: str
    caption: str


def report_plates(root):
    root = Path(root).resolve()
    plates = []
    titles = {
        "visualizacion_individual": "Resumen de todas las fechas",
        "visualizacion_individual_contraste": "Resumen de todas las fechas - contraste",
        "visualizacion_comparativa": "Resumen de comparaciones",
        "resumen_condicion": "Cobertura y porcentajes del resultado",
        "resumen_fecha": "Índices de la fecha",
        "resumen_fecha_contraste": "Índices de la fecha - contraste",
        "resumen_cambio": "Índices de cambio",
        "original_rgb": "Imagen original en color natural",
        "original_final_rgb": "Imagen original de la fecha final",
        "mapas_original_resultado": "Imagen original y mapa de cobertura",
    }
    rank = {name: index for index, name in enumerate(titles)}
    for path in root.rglob("*"):
        if path.suffix.lower() != ".png" or not path.is_file():
            continue
        if not path.resolve().is_relative_to(root):
            continue
        # A PNG companion of a GeoTIFF is a technical export, not another plate.
        if path.with_suffix(".tif").is_file() or path.with_suffix(".tiff").is_file():
            continue
        relative = path.relative_to(root).as_posix()
        parts = Path(relative).parts
        if len(parts) == 1 and path.stem.startswith("visualizacion_individual"):
            section, period = "overview", ""
        elif relative == "visualizacion_comparativa.png":
            section, period = "comparisons_overview", ""
        elif len(parts) > 2 and parts[0] in ("fechas", "intervalos"):
            section = "individual" if parts[0] == "fechas" else "comparison"
            period = parts[1]
        else:
            section, period = "other", ""
        if path.stem.startswith("original"):
            caption = "Color natural B4/B3/B2 como referencia visual de la zona observada."
        elif path.stem in ("resumen_condicion", "mapas_original_resultado"):
            caption = (
                "Cobertura entre fechas: verde indica bosque estable, amarillo señal de degradación, rojo posible deforestación y gris otra cobertura inicial."
                if section == "comparison"
                else "Cobertura de una fecha: verde indica vigor alto, rojo vigor bajo y gris otra cobertura. Los porcentajes usan el área válida."
            )
        elif section in ("comparison", "comparisons_overview"):
            caption = (
                "Cambio = fecha final menos fecha inicial. En los índices: rojo indica descenso y azul aumento. "
                "En la cobertura: verde es bosque estable, amarillo señal de degradación y rojo posible deforestación."
            )
        elif "contraste" in path.stem:
            caption = "Rojo: valor bajo del índice; azul: valor alto. Es la condición de cada fecha, no un cambio temporal."
        elif path.stem in titles:
            caption = "Los índices conservan su escala propia. Ocre indica valores bajos y verde valores altos; las barras muestran p10-p90 y el punto la media."
        else:
            caption = "Mapa complementario del estudio. Utilice su leyenda para interpretar los valores representados."
        plates.append(
            ReportPlate(
                path,
                relative,
                section,
                period,
                titles.get(path.stem, path.stem.replace("_", " ")),
                caption,
            )
        )
    order = {"overview": 0, "individual": 1, "comparisons_overview": 2, "comparison": 3, "other": 4}
    return sorted(
        plates,
        key=lambda item: (
            order[item.section],
            item.period,
            rank.get(item.path.stem, 100),
            item.relative_path,
        ),
    )
