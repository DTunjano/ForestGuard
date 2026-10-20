"""Reúne solo etiquetas temporales verificadas y resume la preparación para ML.

Lee el índice de fragmentos producido por etiquetar_pares_ideam.py. Conserva
las filas 0/1 de etiqueta_par, sin reinterpretar la clase anual IDEAM.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from affine import Affine
from rasterio.features import rasterize


ROOT = Path(__file__).resolve().parents[1]
STAGE = ROOT / "data" / "etiquetas" / "ideam" / "etapa7"
DETAIL = STAGE / "detalle_etiquetado_ideam.csv"
REVISIONS = STAGE / "revisiones_confirmadas"
OUT = STAGE / "dataset_ml"
BANDS = ("B2", "B3", "B4", "B5", "B8", "B11", "B12")
INDICES = ("NDVI", "NDMI", "NBR", "NDRE")
FEATURES = (
    *(f"{name}_{time}" for name in BANDS + INDICES for time in ("t1", "t2")),
    *(f"d{name}" for name in INDICES),
)
META = (
    "id_par", "periodo_ideam", "fecha_inicial", "fecha_final", "fila", "columna",
    "x", "y", "crs", "ideam_fila", "ideam_columna", "codigo_ideam",
    "etiqueta_ideam_anual", "etiqueta_par", "estado_etiqueta_par",
    "ruta_espectral_inicial",
)


def event_shapes() -> dict[tuple[str, str, str, str], list[tuple[str, list]]]:
    result = {}
    for path in sorted(REVISIONS.glob("*.json")):
        if path.name.endswith("_resumen.json"):
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        if data.get("estado_revision") == "NO_APROBADA":
            continue
        key = (data["id_par"], data["periodo_ideam"], data["fecha_inicial"],
               data["fecha_final"])
        value = data.get("id_evento", "").strip()
        vertices = data.get("vertices_pixel")
        if not value and not vertices and data.get("poligonos_sin_cambio_pixel"):
            continue
        if not value or not vertices:
            raise ValueError(f"La revisión positiva requiere id_evento y vertices_pixel en {path}")
        result.setdefault(key, []).append((value, vertices))
    return result


def main() -> None:
    if not DETAIL.is_file():
        raise FileNotFoundError(f"Primero ejecuta --etiquetar: {DETAIL}")
    detail = pd.read_csv(DETAIL, dtype=str, keep_default_na=False, encoding="utf-8-sig")
    if detail.empty or detail["id_par"].duplicated().any():
        raise ValueError("El índice de fragmentos está vacío o contiene pares duplicados")
    events = event_shapes()
    frames = []
    omissions = []
    for row in detail.itertuples(index=False):
        if row.estado != "OK" or not row.fragmento:
            omissions.append({"id_par": row.id_par, "motivo": row.estado})
            continue
        path = Path(row.fragmento)
        if not path.is_file():
            raise FileNotFoundError(path)
        frame = pd.read_csv(path, usecols=list(META + FEATURES), encoding="utf-8-sig")
        frame = frame.loc[frame["etiqueta_par"].isin((0, 1))].copy()
        if frame.empty:
            continue
        zone = frame["ruta_espectral_inicial"].str.extract(
            r"con_calidad[\\/]([^\\/]+)[\\/]", expand=False
        )
        if zone.isna().any():
            raise ValueError(f"No se puede identificar la zona de {path}")
        frame.drop(columns="ruta_espectral_inicial", inplace=True)
        frame.insert(0, "grupo_zona", zone.to_numpy())
        if not np.isfinite(frame.loc[:, FEATURES].to_numpy(dtype=np.float64)).all():
            raise ValueError(f"Variables predictoras no finitas en {path}")
        if frame.duplicated(["id_par", "fila", "columna"]).any():
            raise ValueError(f"Píxeles duplicados en {path}")
        positive = frame["etiqueta_par"].eq(1)
        if (frame.loc[positive, "codigo_ideam"] != 2).any():
            raise ValueError(f"Positivos fuera de la clase IDEAM 2 en {path}")
        if (frame.loc[positive, "estado_etiqueta_par"] != "CAMBIO_PAR_CONFIRMADO").any():
            raise ValueError(f"Positivos sin verificación temporal en {path}")
        key = (str(frame["id_par"].iloc[0]), str(frame["periodo_ideam"].iloc[0]),
               str(frame["fecha_inicial"].iloc[0]), str(frame["fecha_final"].iloc[0]))
        if positive.any() and key not in events:
            raise ValueError(f"Positivos sin revisión JSON e id_evento: {key}")
        pixel_events = np.full(len(frame), "", dtype=object)
        if positive.any():
            rows = frame["fila"].to_numpy(dtype=int)
            cols = frame["columna"].to_numpy(dtype=int)
            shape = (int(rows.max()) + 1, int(cols.max()) + 1)
            for event_id, vertices in events[key]:
                polygon = {"type": "Polygon", "coordinates": [vertices]}
                event_mask = rasterize([(polygon, 1)], out_shape=shape,
                                       transform=Affine.identity(), fill=0,
                                       dtype="uint8").astype(bool)
                selected = positive.to_numpy() & event_mask[rows, cols]
                if np.any(selected & (pixel_events != "") & (pixel_events != event_id)):
                    raise ValueError(f"Polígonos de eventos distintos se superponen en {key}")
                pixel_events[selected] = event_id
            if np.any(positive.to_numpy() & (pixel_events == "")):
                raise ValueError(f"Positivos sin polígono de evento en {key}")
        frame.insert(0, "id_evento", pixel_events)
        frame.insert(1, "grupo_bloque_1km", (
            frame["crs"].astype(str) + ":" +
            np.floor(frame["x"].astype(float) / 1000).astype(int).astype(str) + ":" +
            np.floor(frame["y"].astype(float) / 1000).astype(int).astype(str)
        ))
        frames.append(frame)
    if not frames:
        raise ValueError("No hay fragmentos con etiquetas temporales 0/1")
    data = pd.concat(frames, ignore_index=True)
    if data.duplicated(["id_par", "fila", "columna"]).any():
        raise ValueError("El dataset contiene píxeles duplicados")
    OUT.mkdir(parents=True, exist_ok=True)
    destination = OUT / "pixeles_supervisados.csv"
    data.to_csv(destination, index=False, encoding="utf-8-sig")
    positive = data[data["etiqueta_par"].eq(1)]
    report = {
        "pares_incluidos": int(data["id_par"].nunique()),
        "periodos_incluidos": sorted(data["periodo_ideam"].unique().tolist()),
        "filas_supervisadas": int(len(data)),
        "negativos_confirmados": int(data["etiqueta_par"].eq(0).sum()),
        "positivos_confirmados": int(len(positive)),
        "eventos_positivos_independientes_declarados": sorted(positive["id_evento"].unique().tolist()),
        "zonas_positivas": sorted(positive["grupo_zona"].unique().tolist()),
        "bloques_positivos_1km": int(positive["grupo_bloque_1km"].nunique()),
        "fragmentos_omitidos": omissions,
        "preparacion_entrenamiento": (
            "PENDIENTE_MAS_ZONAS: se necesita una zona positiva externa para validar"
            if positive["grupo_zona"].nunique() < 2
            else "LISTO_PARA_PILOTO_CON_ZONA_EXTERNA; VALIDACION_AUN_LIMITADA"
        ),
        "advertencia": "No dividir píxeles al azar; un evento puede ocupar varios bloques de 1 km.",
    }
    report_path = OUT / "resumen_dataset_ml.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    print(destination)


if __name__ == "__main__":
    main()
