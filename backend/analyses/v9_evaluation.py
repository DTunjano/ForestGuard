"""Evaluate a saved v9 prediction against an independently labeled GeoTIFF."""

import re
from contextlib import ExitStack

import numpy as np
import rasterio
from rasterio.io import MemoryFile

from pipeline.src.binary_overlap import overlap_counts, ratio
from pipeline.src.raster_quality import windows

MAX_REFERENCE_BYTES = 64 * 1024 * 1024
MAX_REFERENCE_PIXELS = 25_000_000
TIFF_HEADERS = {b"II*\x00", b"MM\x00*", b"II+\x00", b"MM\x00+"}
PREDICTION_PATH = re.compile(
    r"intervalos/\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}/clasificacion_piloto/clasificacion_cambio_exploratoria\.tif"
)


def evaluate_reference(prediction_path, upload):
    if upload.read(4) not in TIFF_HEADERS:
        raise ValueError("El archivo no es un GeoTIFF legible.")
    upload.seek(0)
    if upload.size == prediction_path.stat().st_size:
        with prediction_path.open("rb") as source:
            identical = all(source.read(len(chunk)) == chunk for chunk in upload.chunks())
        if identical:
            raise ValueError("El archivo es una copia de la predicción de v9. Carga una máscara de referencia verificada e independiente.")
        upload.seek(0)
    try:
        with ExitStack() as stack:
            stack.enter_context(rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR"))
            prediction = stack.enter_context(rasterio.open(prediction_path))
            if hasattr(upload, "temporary_file_path"):
                reference = stack.enter_context(rasterio.open(upload.temporary_file_path(), driver="GTiff"))
            else:
                memory = stack.enter_context(MemoryFile(upload.read()))
                reference = stack.enter_context(memory.open(driver="GTiff"))
            return compare_rasters(prediction, reference)
    except rasterio.errors.RasterioError as exc:
        raise ValueError("No se pudieron leer la referencia y la predicción como GeoTIFF.") from exc


def compare_rasters(prediction, reference):
    if (
        reference.driver != "GTiff" or reference.count != 1
        or reference.dtypes != ("uint8",) or reference.crs is None
        or reference.nodata not in (None, 255)
        or reference.scales != (1.0,) or reference.offsets != (0.0,)
    ):
        raise ValueError("La referencia debe ser un GeoTIFF georreferenciado de una banda Byte (UInt8), con 255 para píxeles sin etiqueta.")
    if (
        prediction.shape != reference.shape or prediction.crs != reference.crs
        or not prediction.transform.almost_equals(reference.transform, precision=1e-8)
    ):
        raise ValueError("La referencia debe tener el mismo CRS, dimensiones y cuadrícula que el GeoTIFF de predicción.")
    return compare_labels(prediction, lambda window: reference.read(1, window=window, masked=True))


def compare_labels(prediction, read_labels):
    """Score aligned reference labels supplied a window at a time."""
    if prediction.width * prediction.height > MAX_REFERENCE_PIXELS:
        raise ValueError("La cuadrícula supera el límite de 25 millones de píxeles para evaluación.")

    tp = fp = fn = compared = prediction_valid = 0
    for window in windows(prediction):
        predicted = prediction.read(1, window=window, masked=True)
        labels = read_labels(window)
        has_prediction = ~np.ma.getmaskarray(predicted) & (predicted.data != 255)
        has_label = ~np.ma.getmaskarray(labels) & (labels.data != 255)
        if np.any(has_label & (labels.data > 1)):
            raise ValueError("La referencia solo admite 0 (sin pérdida), 1 (pérdida) y 255 (sin etiqueta).")
        if np.any(has_prediction & ~np.isin(predicted.data, (0, 1))):
            raise ValueError("El archivo de predicción contiene clases inesperadas.")
        valid = has_prediction & has_label
        both, false_positive, false_negative = overlap_counts(predicted.data == 1, labels.data == 1, valid)
        tp += both
        fp += false_positive
        fn += false_negative
        compared += int(valid.sum())
        prediction_valid += int(has_prediction.sum())

    if not compared:
        raise ValueError("No hay píxeles con predicción y etiqueta válidas en común.")
    return {
        "jaccard": ratio(tp, tp + fp + fn),
        "precision": ratio(tp, tp + fp),
        "sensibilidad": ratio(tp, tp + fn),
        "verdaderos_positivos": tp,
        "falsos_positivos": fp,
        "falsos_negativos": fn,
        "verdaderos_negativos": compared - tp - fp - fn,
        "pixeles_evaluados": compared,
        "pixeles_prediccion_validos": prediction_valid,
    }
