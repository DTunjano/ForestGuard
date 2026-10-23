"""Envolventes geográficas del piloto; indican soporte observado, no validez."""

from __future__ import annotations

import argparse
from hashlib import sha256
import json
from pathlib import Path

import joblib
import pandas as pd
import rasterio
from rasterio.warp import transform_bounds


def intersectan(first, second):
    return (first[0] <= second[2] and second[0] <= first[2] and
            first[1] <= second[3] and second[1] <= first[3])


def construir_perfil(dataset_path, model_path):
    bundle = joblib.load(model_path)
    expected = bundle["contrato"]["sha256_dataset_supervisado"]
    actual = sha256(dataset_path.read_bytes()).hexdigest()
    if actual != expected:
        raise ValueError("El dataset no coincide con el SHA256 del modelo")
    data = pd.read_csv(dataset_path, usecols=["grupo_zona", "crs", "x", "y",
                                                  "etiqueta_par"], encoding="utf-8-sig")
    if data[["grupo_zona", "crs", "x", "y", "etiqueta_par"]].isna().any().any():
        raise ValueError("El dataset contiene coordenadas o clases faltantes")
    regions = []
    for (zone, crs_text), group in data.groupby(["grupo_zona", "crs"], sort=True):
        crs = rasterio.crs.CRS.from_string(crs_text)
        if not crs.is_projected or abs(crs.linear_units_factor[1] - 1) >= 1e-9:
            raise ValueError(f"La zona {zone} no usa coordenadas proyectadas en metros")
        bounds = [float(group.x.min() - 5), float(group.y.min() - 5),
                  float(group.x.max() + 5), float(group.y.max() + 5)]
        regions.append({
            "grupo_zona": zone, "crs": crs_text,
            "envolvente_nativa": bounds,
            "envolvente_wgs84": list(transform_bounds(crs, "EPSG:4326", *bounds)),
            "observaciones": int(len(group)),
            "positivos": int(group.etiqueta_par.sum()),
        })
    return {
        "sha256_dataset_supervisado": actual,
        "interpretacion": "Envolventes de observaciones supervisadas; coincidencia no valida transferencia",
        "zonas": regions,
    }


def evaluar_escena(path, profile_path, expected_sha):
    path, profile_path = Path(path), Path(profile_path)
    if not profile_path.is_file():
        return {"estado": "perfil_no_disponible",
                "interpretacion": "No se conoce el soporte espacial del entrenamiento"}
    profile = json.loads(profile_path.read_text(encoding="utf-8"))
    if profile.get("sha256_dataset_supervisado") != expected_sha:
        return {"estado": "perfil_no_coincide_con_modelo",
                "interpretacion": "No se puede evaluar soporte espacial con este perfil"}
    with rasterio.open(path) as src:
        bounds = list(transform_bounds(src.crs, "EPSG:4326", *src.bounds))
    matches = [item["grupo_zona"] for item in profile["zonas"]
               if intersectan(bounds, item["envolvente_wgs84"])]
    return {
        "estado": ("intersecta_envolvente_de_entrenamiento" if matches else
                   "fuera_de_envolventes_de_entrenamiento"),
        "envolvente_escena_wgs84": bounds,
        "zonas_intersectadas": matches,
        "interpretacion": (
            "La intersección con una envolvente no demuestra desempeño en esta escena"
            if matches else
            "Zona sin observaciones supervisadas cercanas en el piloto; salida solo exploratoria"
        ),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", type=Path, required=True)
    parser.add_argument("--modelo", type=Path, required=True)
    parser.add_argument("--salida", type=Path, required=True)
    args = parser.parse_args()
    if args.salida.exists():
        raise FileExistsError(args.salida)
    profile = construir_perfil(args.dataset, args.modelo)
    args.salida.parent.mkdir(parents=True, exist_ok=True)
    args.salida.write_text(json.dumps(profile, ensure_ascii=False, indent=2),
                           encoding="utf-8")
    print(json.dumps({"salida": str(args.salida), "zonas": len(profile["zonas"]),
                      "positivos": sum(item["positivos"] for item in profile["zonas"])},
                     ensure_ascii=False))


if __name__ == "__main__":
    main()
