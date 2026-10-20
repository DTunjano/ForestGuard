"""Interfaz CLI portable para índices, series y cambio histórico exploratorio.

Recibe GeoTIFF de siete bandas ya estandarizados. Procesa ventanas de tamaño
acotado; el modelo opcional solo clasifica intervalos compatibles de dos fechas.
"""

from __future__ import annotations

import argparse
from contextlib import ExitStack
from datetime import date
import json
from pathlib import Path
import subprocess
import sys

import joblib
import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.vrt import WarpedVRT
from rasterio.windows import Window

from calcular_indices_cambios_scl import INDEX_NAMES, calculate_indices
from contrato_inferencia_ideam import VERSION
from esquema_bandas_forestguard import HISTORICAL_BANDS
from inferir_par_ideam import validar_entrada, validar_fecha_nombre
from inferir_par_ideam_ventanas import read_window


class HistogramSummary:
    """Cuantiles aproximados mediante un histograma de memoria constante."""

    def __init__(self, low: float, high: float, step: float = .0005):
        self.step = step
        self.edges = np.linspace(low, high, int((high - low) / step) + 1)
        self.counts = np.zeros(len(self.edges) - 1, dtype=np.int64)
        self.total = 0
        self.sum = 0.0

    def add(self, values: np.ndarray):
        finite = values[np.isfinite(values)]
        if not finite.size:
            return
        if np.any((finite < self.edges[0]) | (finite > self.edges[-1])):
            raise ValueError("Índice fuera del rango matemático esperado")
        self.total += finite.size
        self.sum += float(finite.sum(dtype=np.float64))
        self.counts += np.histogram(finite, bins=self.edges)[0]

    def quantile(self, fraction: float):
        if not self.total:
            return None
        position = np.searchsorted(np.cumsum(self.counts), fraction * (self.total - 1) + 1)
        return float((self.edges[position] + self.edges[position + 1]) / 2)

    def result(self):
        return {"pixeles_validos": int(self.total),
                "media": self.sum / self.total if self.total else None,
                "p10": self.quantile(.1), "mediana": self.quantile(.5),
                "p90": self.quantile(.9),
                "metodo_cuantiles": f"histograma_anchura_{self.step}"}


def parse_scene(raw: str):
    if "=" not in raw:
        raise ValueError("Usa --escena AAAA-MM-DD=RUTA")
    acquisition, path = raw.split("=", 1)
    return date.fromisoformat(acquisition), Path(path).resolve()


def windows(source, side):
    for row in range(0, source.height, side):
        for col in range(0, source.width, side):
            yield Window(col, row, min(side, source.width-col),
                         min(side, source.height-row))


def indices_from(source, indexes, window):
    values, valid = read_window(source, indexes, window)
    if np.any(values[:, valid] > 1):
        raise ValueError(f"Reflectancia superior a 1 en {source.name}")
    indices = calculate_indices(values)
    for item in indices.values():
        valid &= np.isfinite(item)
    return indices, valid


def output_profile(source):
    profile = source.profile.copy()
    profile.update(driver="GTiff", count=1, dtype="float32", nodata=np.nan,
                   compress="deflate", predictor=3, BIGTIFF="IF_SAFER")
    return profile


def area_pixel_m2(source):
    if source.crs is None or not source.crs.is_projected:
        return None
    factor = source.crs.linear_units_factor[1]
    return abs(source.transform.a*source.transform.e -
               source.transform.b*source.transform.d) * factor**2


def create_rasters(stack, folder, names, profile):
    folder.mkdir(parents=True, exist_ok=True)
    outputs = {}
    for name in names:
        output = stack.enter_context(rasterio.open(folder / f"{name}.tif", "w", **profile))
        output.set_band_description(1, name)
        outputs[name] = output
    return outputs


def aligned(stack, source, reference, method):
    return stack.enter_context(WarpedVRT(
        source, crs=reference.crs, transform=reference.transform,
        width=reference.width, height=reference.height,
        src_nodata=np.nan, nodata=np.nan, resampling=method,
    ))


def describe_scene(acquisition, path, output, side):
    with rasterio.open(path) as source, ExitStack() as stack:
        indexes = [source.descriptions.index(name) + 1 for name in HISTORICAL_BANDS]
        profile = output_profile(source)
        rasters = create_rasters(stack, output / "fechas" / str(acquisition),
                                 INDEX_NAMES, profile)
        stats = {name: HistogramSummary(-1, 1) for name in INDEX_NAMES}
        for window in windows(source, side):
            indices, valid = indices_from(source, indexes, window)
            for name in INDEX_NAMES:
                arr = indices[name]
                arr[~valid] = np.nan
                rasters[name].write(arr, 1, window=window)
                stats[name].add(arr)
        count = stats["NDVI"].total
        pixel_area = area_pixel_m2(source)
        return {"fecha": str(acquisition), "imagen": str(path),
                "pixeles_validos": count,
                "pixeles_totales": source.width * source.height,
                "fraccion_valida": count / (source.width * source.height),
                "area_observada_ha_aprox": (count * pixel_area / 10_000
                                            if pixel_area else None),
                "indices": {name: item.result() for name, item in stats.items()},
                "procesamiento_entrada": source.tags().get("processing")}


def describe_interval(first, second, output, side):
    d1, p1 = first
    d2, p2 = second
    with rasterio.open(p1) as initial, rasterio.open(p2) as final, ExitStack() as stack:
        before_indexes = [initial.descriptions.index(name) + 1 for name in HISTORICAL_BANDS]
        after_indexes = [final.descriptions.index(name) + 1 for name in HISTORICAL_BANDS]
        bilinear = aligned(stack, final, initial, Resampling.bilinear)
        nearest = aligned(stack, final, initial, Resampling.nearest)
        names = [f"d{name}" for name in INDEX_NAMES]
        folder = output / "intervalos" / f"{d1}_{d2}"
        rasters = create_rasters(stack, folder, names, output_profile(initial))
        stats = {name: HistogramSummary(-2, 2) for name in names}
        scl_quality = all("tras máscara SCL" in src.tags().get("processing", "")
                          for src in (initial, final))
        degradation_counts = np.zeros(4, dtype=np.int64)
        if scl_quality:
            degradation_profile = initial.profile.copy()
            degradation_profile.update(driver="GTiff", count=1, dtype="uint8",
                                       nodata=255, compress="deflate", BIGTIFF="IF_SAFER")
            degradation = stack.enter_context(rasterio.open(
                folder / "indicios_degradacion_observada.tif", "w",
                **degradation_profile))
            degradation.set_band_description(1, "Indicios espectrales de degradación")
            degradation.update_tags(
                clases="0=sin_indicios_segun_regla;1=indicios;2=fuera_de_vegetacion_remanente;255=sin_datos",
                metodo="Regla exploratoria no validada como degradación forestal")
        for window in windows(initial, side):
            before, valid_before = indices_from(initial, before_indexes, window)
            after, valid_after = indices_from(bilinear, after_indexes, window)
            _, valid_nearest = read_window(nearest, after_indexes, window)
            valid = valid_before & valid_after & valid_nearest
            differences = {}
            for name in INDEX_NAMES:
                difference = (after[name] - before[name]).astype(np.float32)
                difference[~valid] = np.nan
                rasters[f"d{name}"].write(difference, 1, window=window)
                stats[f"d{name}"].add(difference)
                differences[name] = difference
            if scl_quality:
                # NDVI alto al inicio y vegetación remanente al final son solo
                # proxies espectrales; no prueban cobertura de bosque.
                eligible = valid & (before["NDVI"] >= .60) & (after["NDVI"] >= .40)
                signal = eligible & (differences["NDVI"] <= -.10)
                signal &= (differences["NDMI"] <= -.05) & (differences["NBR"] <= -.08)
                classes = np.full(valid.shape, 255, dtype=np.uint8)
                classes[valid] = 2
                classes[eligible] = 0
                classes[signal] = 1
                degradation.write(classes, 1, window=window)
                degradation_counts += np.bincount(classes.ravel(), minlength=256)[[0, 1, 2, 255]]
        common_count = stats["dNDVI"].total
        pixel_area = area_pixel_m2(initial)
        degradation_summary = {
            "estado": "evaluada_como_indicio" if scl_quality else "omitida_sin_mascara_scl",
            "conclusion": ("indicios_espectrales_detectados" if degradation_counts[1]
                           else "sin_indicios_segun_regla") if scl_quality else "no_evaluable",
            "confirmacion_degradacion_forestal": False,
            "interpretacion": "La señal requiere revisión visual y referencia de bosque; su ausencia no descarta degradación.",
            "regla_exploratoria": {
                "ndvi_inicial_minimo": .60, "ndvi_final_minimo": .40,
                "dndvi_maximo": -.10, "dndmi_maximo": -.05, "dnbr_maximo": -.08,
                "condicion": "Todas las condiciones deben cumplirse; umbrales no calibrados con verdad de terreno."},
            "raster": str(folder / "indicios_degradacion_observada.tif") if scl_quality else None,
            "leyenda": {"0": "sin indicios según regla", "1": "indicios espectrales",
                        "2": "fuera de vegetación remanente", "255": "sin datos"},
            "pixeles_sin_indicios": int(degradation_counts[0]),
            "pixeles_con_indicios": int(degradation_counts[1]),
            "pixeles_fuera_de_proxy": int(degradation_counts[2]),
            "fraccion_con_indicios_entre_elegibles": (
                int(degradation_counts[1]) / int(degradation_counts[0] + degradation_counts[1])
                if degradation_counts[0] + degradation_counts[1] else None),
            "advertencia_cambio_generalizado": (
                "La señal afecta al menos un cuarto de los píxeles elegibles; revisar diferencias de estación, humedad y adquisición."
                if degradation_counts[1] and
                degradation_counts[1] / (degradation_counts[0] + degradation_counts[1]) >= .25
                else None),
            "area_con_indicios_ha_aprox": (int(degradation_counts[1]) * pixel_area / 10_000
                                           if pixel_area and scl_quality else None),
        }
        return {"fecha_inicial": str(d1), "fecha_final": str(d2),
                "dias": (d2-d1).days, "pixeles_comunes": common_count,
                "fraccion_comun": common_count / (initial.width * initial.height),
                "area_comun_ha_aprox": (common_count * pixel_area / 10_000
                                         if pixel_area else None),
                "diferencias": {name: item.result() for name, item in stats.items()},
                "degradacion_observada": degradation_summary}, folder


def describe_trend(scenes, output, side):
    first_date, first_path = scenes[0]
    with rasterio.open(first_path) as reference, ExitStack() as stack:
        sources = [reference]
        for _, path in scenes[1:]:
            source = stack.enter_context(rasterio.open(path))
            sources.append(aligned(stack, source, reference, Resampling.bilinear))
        indexes = [[src.descriptions.index(name) + 1 for name in HISTORICAL_BANDS]
                   for src in sources]
        destination = stack.enter_context(rasterio.open(
            output / "tendencia_ndvi_por_anio.tif", "w", **output_profile(reference)))
        destination.set_band_description(1, "Pendiente NDVI anual descriptiva")
        years = np.array([(day-first_date).days / 365.25 for day, _ in scenes])
        summary = HistogramSummary(-750, 750, .01)
        count_valid = 0
        for window in windows(reference, side):
            ndvis = []
            for source, order in zip(sources, indexes):
                indices, valid = indices_from(source, order, window)
                ndvi = indices["NDVI"]
                ndvi[~valid] = np.nan
                ndvis.append(ndvi)
            cube = np.stack(ndvis)
            available = np.isfinite(cube)
            count = available.sum(axis=0)
            weights = available.astype(np.float64)
            t = years[:, None, None]
            sum_t = (t * weights).sum(axis=0)
            sum_y = np.nansum(cube, axis=0)
            sum_tt = (t*t*weights).sum(axis=0)
            sum_ty = np.nansum(cube*t, axis=0)
            denominator = count*sum_tt - sum_t*sum_t
            slope = np.full(count.shape, np.nan, dtype=np.float32)
            valid = (count >= 3) & (denominator > 1e-8)
            np.divide(count*sum_ty - sum_t*sum_y, denominator,
                      out=slope, where=valid)
            destination.write(slope, 1, window=window)
            count_valid += int(valid.sum())
            summary.add(slope)
        return {"raster": str(output / "tendencia_ndvi_por_anio.tif"),
                "pixeles_con_tres_fechas": count_valid,
                "pendiente_ndvi_por_anio": summary.result(),
                "interpretacion": "Tendencia espectral descriptiva; no es riesgo futuro"}


def run_model(first, second, folder, model, side):
    d1, p1 = first
    d2, p2 = second
    target = folder / "clasificacion_piloto"
    command = [sys.executable, str(Path(__file__).with_name("inferir_par_ideam_ventanas.py")),
               "--modelo", str(model), "--imagen-inicial", str(p1),
               "--imagen-final", str(p2), "--fecha-inicial", str(d1),
               "--fecha-final", str(d2), "--salida", str(target),
               "--ventana", str(side)]
    subprocess.run(command, check=True)
    subprocess.run([sys.executable,
                    str(Path(__file__).with_name("resumir_salida_cambio_historico.py")),
                    "--inferencia", str(target)], check=True)
    return json.loads((target / "resumen_superficie.json").read_text(encoding="utf-8"))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--escena", action="append", required=True,
                        help="Repetir AAAA-MM-DD=RUTA para una o más fechas")
    parser.add_argument("--salida", type=Path, required=True)
    parser.add_argument("--modelo", type=Path,
                        help="Modelo v9 para cambio histórico; omitir para solo índices")
    parser.add_argument("--ventana", type=int, default=512)
    args = parser.parse_args()
    if not 64 <= args.ventana <= 1024:
        parser.error("--ventana debe estar entre 64 y 1024")
    scenes = sorted(map(parse_scene, args.escena))
    if len(scenes) > 32 or len({d for d, _ in scenes}) != len(scenes):
        raise ValueError("Se admiten 1 a 32 fechas distintas")
    if args.salida.exists():
        raise FileExistsError(args.salida)
    for acquisition, path in scenes:
        validar_fecha_nombre(path, acquisition)
        validar_entrada(path, HISTORICAL_BANDS, requiere_scl=False, max_pixeles=None)
    contract = None
    if args.modelo:
        if len(scenes) < 2:
            raise ValueError("El modelo requiere al menos dos fechas")
        contract = joblib.load(args.modelo).get("contrato")
        if not contract or contract.get("version") != VERSION:
            raise ValueError("Contrato del modelo incompatible")
        profile_path = args.modelo.parent / "perfil_desempeno.json"
        quality = (json.loads(profile_path.read_text(encoding="utf-8"))
                   if profile_path.is_file() else None)
        if quality and quality["sha256_dataset_supervisado"] != contract["sha256_dataset_supervisado"]:
            raise ValueError("El perfil de desempeño no corresponde al modelo")
    else:
        quality = None
    args.salida.mkdir(parents=True)
    report = {"version_pipeline": "forestguard_historico_v2",
              "modalidad": "indices_una_fecha" if len(scenes) == 1 else "serie_multifecha",
              "alcance": "índices, indicios de degradación y cambio histórico; sin riesgo futuro",
              "escenas": [], "intervalos": [],
              "degradacion_una_fecha": ("no_evaluable_sin_comparacion_temporal"
                                           if len(scenes) == 1 else None),
              "deforestacion_una_fecha": ("no_evaluable_sin_comparacion_temporal"
                                            if len(scenes) == 1 else None),
              "modelo_temporal": str(args.modelo.resolve()) if args.modelo else None,
              "calidad_modelo": quality,
              "ventana_pixeles": args.ventana}
    for acquisition, path in scenes:
        report["escenas"].append(describe_scene(acquisition, path, args.salida, args.ventana))
    for first, second in zip(scenes, scenes[1:]):
        item, folder = describe_interval(first, second, args.salida, args.ventana)
        if contract:
            reason = None
            days = item["dias"]
            low, high = contract["intervalo_entrenamiento_dias"]
            if not low <= days <= high:
                reason = f"Intervalo fuera del contrato de {low} a {high} días"
            elif item["pixeles_comunes"] == 0:
                reason = "Sin píxeles comunes válidos"
            else:
                try:
                    for _, path in (first, second):
                        validar_entrada(path, HISTORICAL_BANDS, requiere_scl=True,
                                        max_pixeles=None)
                    with rasterio.open(first[1]) as a, rasterio.open(second[1]) as b:
                        if a.crs != b.crs:
                            reason = "El contrato del modelo requiere CRS idéntico"
                except ValueError as error:
                    reason = str(error)
            if reason:
                item.update(estado_clasificacion="omitida", motivo_omision=reason,
                            deforestacion_observada={"estado": "no_evaluable",
                                                     "motivo": reason})
            else:
                area = run_model(first, second, folder, args.modelo, args.ventana)
                positive = area.get("pixeles_clase_1", 0)
                item.update(estado_clasificacion="ejecutada",
                            clasificacion_piloto=str(folder / "clasificacion_piloto"),
                            superficie=area,
                            deforestacion_observada={
                                "estado": ("indicios_de_cambio_detectados" if positive
                                           else "sin_indicios_segun_modelo"),
                                "pixeles_clase_1": positive,
                                "confirmacion_deforestacion_ideam": False,
                                "interpretacion": "Clasificación exploratoria de cambio histórico; requiere verificación visual."})
        else:
            item["deforestacion_observada"] = {
                "estado": "no_evaluable_sin_modelo",
                "interpretacion": "Las diferencias espectrales no confirman deforestación."}
        report["intervalos"].append(item)
    if len(scenes) >= 3:
        report["tendencia"] = describe_trend(scenes, args.salida, args.ventana)
    destination = args.salida / "resumen_serie.json"
    destination.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"resumen": str(destination), "escenas": len(scenes),
                      "intervalos": len(report["intervalos"])}, ensure_ascii=False))


if __name__ == "__main__":
    main()
