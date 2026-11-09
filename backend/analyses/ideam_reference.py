"""Assemble a conservative IDEAM annual reference for a saved prediction."""

from contextlib import ExitStack
from dataclasses import dataclass
from datetime import date

import numpy as np
import rasterio
from django.conf import settings
from rasterio.enums import Resampling
from rasterio.vrt import WarpedVRT

from .v9_evaluation import compare_labels

CATALOG_URL = "https://bart.ideam.gov.co/smbyc/Cambio%20en%20la%20superficie%20cubierta%20por%20bosque%20natural/Capas/"
ANNUAL_FILES = {
    2019: "cambio_2018_2019_v8_200707.img",
    2020: "cambio_2019-2020_v8_210702.img",
    2021: "cambio_2020_2021_v8_220710.img",
    2022: "cambio_2021_2022_v8_230705.img",
    2023: "cambio_2022_2023_V8_240703.img",
    2024: "cambio_2023_2024_v8_250721.img",
    2025: "cambio_2024_2025_v8_260729.img",
}


@dataclass(frozen=True)
class IdeamPlan:
    years: tuple[int, ...]
    complete_years: tuple[int, ...]
    reason: str = ""

    @property
    def available(self):
        return not self.reason


def plan_reference(artifact):
    first, last = artifact.relative_path.split("/")[1].split("_")
    start, end = date.fromisoformat(first), date.fromisoformat(last)
    years = tuple(range(start.year, end.year + 1))
    complete = tuple(year for year in years if start <= date(year, 1, 1) and end >= date(year, 12, 31))
    interval = next((
        item for item in artifact.analysis.summary.get("intervalos", [])
        if item.get("fecha_inicial") == first and item.get("fecha_final") == last
    ), {})
    support = (interval.get("superficie") or {}).get("limite_territorial") or {}
    if support.get("estado") != "fuera_de_envolventes_de_entrenamiento":
        return IdeamPlan(years, complete, "No se ha confirmado que este intervalo esté fuera de las zonas supervisadas registradas de v9.")
    if not complete:
        return IdeamPlan(years, complete, "El intervalo no contiene un año calendario completo. Una capa anual no permite fechar las pérdidas dentro de este par.")
    missing = [
        year for year in years
        if year not in ANNUAL_FILES or not (settings.IDEAM_REFERENCE_ROOT / ANNUAL_FILES[year]).is_file()
    ]
    if missing:
        labels = ", ".join(map(str, missing))
        return IdeamPlan(years, complete, f"Faltan capas IDEAM en el catálogo local para {labels}.")
    return IdeamPlan(years, complete)


def annual_labels(aligned, complete_years, window):
    """Keep stable pixels and losses whose annual period fits the scene interval."""
    eligible = np.ones((int(window.height), int(window.width)), dtype=bool)
    loss = np.zeros_like(eligible)
    for year, layer in aligned.items():
        classes = layer.read(1, window=window, masked=True)
        valid = ~np.ma.getmaskarray(classes)
        if np.any(valid & ~np.isin(classes.data, (0, 1, 2, 3, 4, 5))):
            raise ValueError(f"La capa IDEAM de {year} tiene códigos fuera de la leyenda instalada.")
        is_loss = valid & (classes.data == 2)
        stable = valid & np.isin(classes.data, (1, 5))
        if year in complete_years:
            eligible &= stable | is_loss
            loss |= is_loss
        else:
            eligible &= stable
    return np.ma.array(loss.astype("uint8"), mask=~eligible)


def evaluate_ideam(prediction_path, plan):
    try:
        with ExitStack() as stack:
            prediction = stack.enter_context(rasterio.open(prediction_path))
            aligned = {}
            for year in plan.years:
                source = stack.enter_context(rasterio.open(settings.IDEAM_REFERENCE_ROOT / ANNUAL_FILES[year]))
                if source.count != 1 or source.crs is None or source.dtypes != ("uint8",):
                    raise ValueError(f"La capa IDEAM de {year} debe tener georreferenciación y una banda Byte.")
                aligned[year] = stack.enter_context(WarpedVRT(
                    source, crs=prediction.crs, transform=prediction.transform,
                    width=prediction.width, height=prediction.height,
                    resampling=Resampling.nearest, nodata=255,
                ))
            return compare_labels(
                prediction, lambda window: annual_labels(aligned, plan.complete_years, window),
            )
    except rasterio.errors.RasterioError as exc:
        raise ValueError("No se pudieron alinear las capas IDEAM con la predicción.") from exc
