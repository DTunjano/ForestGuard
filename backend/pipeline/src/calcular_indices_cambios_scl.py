r"""
ETAPA 6: seleccionar pares cronológicos y calcular índices/cambios con grillas alineadas.

Ejecutar desde la raíz del proyecto:
    python src\calcular_indices_cambios_scl.py

Usa:
- data/temporal/inspeccion_calidad/pares_temporales_validados_scl.csv
- data/procesadas/espectrales_7bandas_scl/

IMPORTANTE:
- Los 37.581 pares validados son combinaciones geométricas posibles, no todos son
  necesarios para el primer análisis. Para evitar miles de comparaciones redundantes,
  se conserva para cada imagen inicial el par válido con la fecha posterior más cercana.
- Se reproyectan/alinean las 7 bandas de la imagen final a la grilla de la inicial.
- Solo se comparan píxeles con las 7 bandas válidas en ambas fechas.
- dNDVI/dNDMI/dNBR/dNDRE son indicadores de cambio espectral, NO etiquetas definitivas
  de deforestación.
- No modifica los GeoTIFF de entrada.
"""
from pathlib import Path
import re
import sys
import warnings

import numpy as np
import pandas as pd

try:
    import rasterio
    from rasterio.warp import reproject, Resampling
except ImportError:
    sys.exit("ERROR: falta rasterio. Activa .venv e instala rasterio.")

ROOT = Path(__file__).resolve().parents[1]
QA_DIR = ROOT / "data" / "temporal" / "inspeccion_calidad"
VALIDATED_CSV = QA_DIR / "pares_temporales_validados_scl.csv"
STANDARD_DIR = ROOT / "data" / "procesadas" / "espectrales_7bandas_scl"
OUT_ROOT = ROOT / "data" / "temporal" / "indices_cambios_scl"
OUT_SUMMARY_CSV = OUT_ROOT / "resumen_indices_cambios_scl.csv"
OUT_ERRORS_CSV = OUT_ROOT / "errores_indices_cambios_scl.csv"
OUT_SELECTED_CSV = OUT_ROOT / "pares_seleccionados_para_analisis.csv"
BANDS = ["B8", "B4", "B3", "B2", "B5", "B11", "B12"]
INDEX_NAMES = ["NDVI", "NDMI", "NBR", "NDRE"]


def parse_date(value):
    try:
        return pd.to_datetime(value, errors="raise")
    except Exception:
        m = re.search(r"(20\d{2})[-_]?(\d{2})[-_]?(\d{2})", str(value))
        if not m:
            return pd.NaT
        return pd.Timestamp(int(m.group(1)), int(m.group(2)), int(m.group(3)))


def build_standardized_index():
    """Indexa las copias estandarizadas por nombre de archivo."""
    if not STANDARD_DIR.exists():
        raise FileNotFoundError(f"No existe la carpeta de bandas estandarizadas: {STANDARD_DIR}")
    index = {}
    duplicates = {}
    for p in STANDARD_DIR.rglob("*.tif"):
        key = p.name.lower()
        if key in index:
            duplicates.setdefault(key, [index[key]]).append(p)
        else:
            index[key] = p
    if duplicates:
        examples = "; ".join(
            f"{k}: {[str(x) for x in paths[:3]]}" for k, paths in list(duplicates.items())[:5]
        )
        raise ValueError(
            "Hay nombres de GeoTIFF duplicados en la carpeta estandarizada; "
            "no es seguro emparejar por nombre solamente. Ejemplos: " + examples
        )
    return index


def standardized_path(value, standardized_index):
    """Resuelve archivo original del CSV a la copia estandarizada por nombre exacto."""
    raw = str(value).strip().strip('"')
    if not raw or raw.lower() == "nan":
        raise FileNotFoundError("La ruta del raster está vacía en el CSV.")
    basename = Path(raw.replace("\\", "/")).name.lower()
    candidate = standardized_index.get(basename)
    if candidate is None:
        raise FileNotFoundError(
            f"No se encontró {basename} en {STANDARD_DIR}. "
            "Comprueba que la salida estandarizada conserve el nombre original."
        )
    return candidate


def load_band_stack(path):
    with rasterio.open(path) as src:
        if src.count != 7:
            raise ValueError(f"Se esperaban exactamente 7 bandas en {path}; encontradas: {src.count}")
        desc = [str(x).upper().strip() if x else "" for x in src.descriptions]
        if desc != BANDS:
            raise ValueError(f"Orden/descripciones inesperadas en {path}: {src.descriptions}; esperado: {BANDS}")
        arr = src.read(masked=True, out_dtype="float32")
        values = arr.filled(np.nan).astype(np.float32)
        valid = np.all(~np.ma.getmaskarray(arr), axis=0) & np.all(np.isfinite(values), axis=0)
        valid &= np.all(values >= 0, axis=0)
        meta = {
            "profile": src.profile.copy(),
            "transform": src.transform,
            "crs": src.crs,
            "width": src.width,
            "height": src.height,
            "bounds": src.bounds,
        }
        return values, valid, meta


def align_final_to_initial(final_values, final_valid, final_meta, initial_meta):
    """Alinea reflectancias continuas con bilinear y máscara válida con vecino más cercano."""
    h, w = initial_meta["height"], initial_meta["width"]
    aligned = np.full((7, h, w), np.nan, dtype=np.float32)
    for band_idx in range(7):
        reproject(
            source=final_values[band_idx],
            destination=aligned[band_idx],
            src_transform=final_meta["transform"],
            src_crs=final_meta["crs"],
            src_nodata=np.nan,
            dst_transform=initial_meta["transform"],
            dst_crs=initial_meta["crs"],
            dst_nodata=np.nan,
            resampling=Resampling.bilinear,
            init_dest_nodata=True,
        )
    aligned_valid = np.zeros((h, w), dtype=np.uint8)
    reproject(
        source=final_valid.astype(np.uint8),
        destination=aligned_valid,
        src_transform=final_meta["transform"],
        src_crs=final_meta["crs"],
        src_nodata=0,
        dst_transform=initial_meta["transform"],
        dst_crs=initial_meta["crs"],
        dst_nodata=0,
        resampling=Resampling.nearest,
        init_dest_nodata=True,
    )
    valid = (aligned_valid == 1) & np.all(np.isfinite(aligned), axis=0)
    valid &= np.all(aligned >= 0, axis=0)
    return aligned, valid


def safe_ratio(a, b):
    out = np.full(a.shape, np.nan, dtype=np.float32)
    ok = np.isfinite(a) & np.isfinite(b) & (np.abs(b) > 1e-10)
    out[ok] = a[ok] / b[ok]
    return out


def calculate_indices(stack):
    # Índices: stack posicional verificado por las descripciones canónicas.
    b = {name: stack[i] for i, name in enumerate(BANDS)}
    return {
        "NDVI": safe_ratio(b["B8"] - b["B4"], b["B8"] + b["B4"]),
        "NDMI": safe_ratio(b["B8"] - b["B11"], b["B8"] + b["B11"]),
        "NBR": safe_ratio(b["B8"] - b["B12"], b["B8"] + b["B12"]),
        "NDRE": safe_ratio(b["B8"] - b["B5"], b["B8"] + b["B5"]),
    }


def write_single_band(array, path, profile, description):
    p = profile.copy()
    p.update(driver="GTiff", count=1, dtype="float32", nodata=np.nan,
             compress="deflate", predictor=3, tiled=True)
    path.parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(path, "w", **p) as dst:
        dst.write(array.astype(np.float32), 1)
        dst.set_band_description(1, description)


def choose_pairs(df, standardized_index):
    required = {
        "archivo_inicial", "archivo_final", "fecha_inicial", "fecha_final",
        "estado_validacion", "pixeles_validos_comunes"
    }
    missing = required - set(df.columns)
    if missing:
        raise ValueError("Faltan columnas en el CSV validado: " + ", ".join(sorted(missing)))

    valid = df[
        df["estado_validacion"].isin(["VALIDO_GRILLA_IDENTICA", "VALIDO_REQUIERE_ALINEACION"])
    ].copy()
    valid["fecha_inicial_dt"] = valid["fecha_inicial"].map(parse_date)
    valid["fecha_final_dt"] = valid["fecha_final"].map(parse_date)
    valid["dias_entre_fechas"] = pd.to_numeric(
        valid["dias_entre_fechas"] if "dias_entre_fechas" in valid.columns
        else (valid["fecha_final_dt"] - valid["fecha_inicial_dt"]).dt.days,
        errors="coerce"
    )
    valid["pixeles_validos_comunes"] = pd.to_numeric(
        valid["pixeles_validos_comunes"], errors="coerce"
    ).fillna(0)

    valid = valid[
        valid["fecha_inicial_dt"].notna()
        & valid["fecha_final_dt"].notna()
        & (valid["fecha_final_dt"] > valid["fecha_inicial_dt"])
        & (valid["pixeles_validos_comunes"] > 0)
    ].copy()

    # Primera pasada: para cada escena inicial, escoger la fecha posterior más cercana.
    # Si una ruta no tiene una copia estandarizada, se registra el motivo y se excluye.
    resolved_initial, resolved_final, resolution_errors = [], [], []
    for _, row in valid.iterrows():
        try:
            p1 = standardized_path(row["archivo_inicial"], standardized_index)
            p2 = standardized_path(row["archivo_final"], standardized_index)
            resolved_initial.append(str(p1))
            resolved_final.append(str(p2))
            resolution_errors.append("")
        except Exception as exc:
            resolved_initial.append("")
            resolved_final.append("")
            resolution_errors.append(str(exc))
    valid["ruta_espectral_inicial"] = resolved_initial
    valid["ruta_espectral_final"] = resolved_final
    valid["error_resolucion_rutas"] = resolution_errors
    valid = valid[
        (valid["ruta_espectral_inicial"] != "")
        & (valid["ruta_espectral_final"] != "")
    ].copy()

    valid = valid.sort_values(
        ["archivo_inicial", "dias_entre_fechas", "pixeles_validos_comunes", "archivo_final"],
        ascending=[True, True, False, True]
    )
    selected = valid.drop_duplicates(subset=["archivo_inicial"], keep="first").copy()
    return selected


def process_pair(row):
    p1 = Path(row["ruta_espectral_inicial"])
    p2 = Path(row["ruta_espectral_final"])
    v1, valid1, m1 = load_band_stack(p1)
    v2, valid2, m2 = load_band_stack(p2)
    if m1["crs"] is None or m2["crs"] is None or m1["crs"] != m2["crs"]:
        raise ValueError(f"CRS incompatible: inicial={m1['crs']}, final={m2['crs']}")
    final_aligned, valid2_aligned = align_final_to_initial(v2, valid2, m2, m1)
    valid_common = valid1 & valid2_aligned
    if not valid_common.any():
        raise ValueError("No quedaron píxeles válidos comunes después de alinear las reflectancias.")

    idx1 = calculate_indices(v1)
    idx2 = calculate_indices(final_aligned)
    for name in INDEX_NAMES:
        valid_common &= np.isfinite(idx1[name]) & np.isfinite(idx2[name])
    if not valid_common.any():
        raise ValueError("No quedaron píxeles válidos comunes para los cuatro índices.")

    date1 = parse_date(row["fecha_inicial"])
    date2 = parse_date(row["fecha_final"])
    label = f"{date1:%Y%m%d}_{date2:%Y%m%d}"
    safe_initial = re.sub(r"[^A-Za-z0-9_.-]+", "_", Path(str(row["archivo_inicial"])).stem)
    pair_id = f"{safe_initial}__{label}"
    outdir = OUT_ROOT / "pares" / pair_id
    outdir.mkdir(parents=True, exist_ok=True)

    delta = {}
    for name in INDEX_NAMES:
        d = (idx2[name] - idx1[name]).astype(np.float32)
        d[~valid_common] = np.nan
        delta[name] = d
        write_single_band(
            d, outdir / f"d{name}.tif", m1["profile"],
            f"d{name} ({date2:%Y-%m-%d} - {date1:%Y-%m-%d})"
        )

    # Este compuesto es un indicador exploratorio de descensos simultáneos,
    # no una clasificación de deforestación.
    changes = np.zeros(valid_common.shape, dtype=np.float32)
    for name in INDEX_NAMES:
        changes += (delta[name] < 0).astype(np.float32)
    changes[~valid_common] = np.nan
    write_single_band(
        changes, outdir / "cambios.tif", m1["profile"],
        "Cantidad de indices con diferencia negativa (0-4); no es etiqueta de deforestacion"
    )

    rec = {
        "id_par": pair_id,
        "archivo_inicial": row["archivo_inicial"],
        "archivo_final": row["archivo_final"],
        "fecha_inicial": f"{date1:%Y-%m-%d}",
        "fecha_final": f"{date2:%Y-%m-%d}",
        "dias_entre_fechas": int((date2 - date1).days),
        "ruta_espectral_inicial": str(p1),
        "ruta_espectral_final": str(p2),
        "crs": str(m1["crs"]),
        "ancho_grilla_inicial": m1["width"],
        "alto_grilla_inicial": m1["height"],
        "pixeles_validos_comunes_finales": int(valid_common.sum()),
        "fraccion_valida_grilla_inicial": float(valid_common.mean()),
        "grilla_salida": "grilla de imagen inicial; reflectancias finales alineadas",
        "ruta_salida": str(outdir),
    }
    for name in INDEX_NAMES:
        vals = delta[name][valid_common]
        rec[f"d{name}_media"] = float(np.mean(vals))
        rec[f"d{name}_mediana"] = float(np.median(vals))
        rec[f"d{name}_p05"] = float(np.percentile(vals, 5))
        rec[f"d{name}_p95"] = float(np.percentile(vals, 95))
        rec[f"d{name}_fraccion_negativa"] = float(np.mean(vals < 0))
    vals = changes[valid_common]
    rec["cambios_media_indices_negativos_0a4"] = float(np.mean(vals))
    rec["cambios_pixeles_con_3o4_indices_negativos"] = int(np.sum(vals >= 3))
    return rec


def main():
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    if not VALIDATED_CSV.exists():
        sys.exit(f"ERROR: no existe {VALIDATED_CSV}")
    if not STANDARD_DIR.exists():
        sys.exit(f"ERROR: no existe {STANDARD_DIR}. Ejecuta primero preparar_bandas_espectrales_scl.py")

    df = pd.read_csv(VALIDATED_CSV, encoding="utf-8-sig")
    print("=" * 76)
    print("ETAPA 6 - ÍNDICES ESPECTRALES Y CAMBIOS TEMPORALES")
    print("=" * 76)
    print(f"Pares validados recibidos: {len(df)}")
    try:
        standardized_index = build_standardized_index()
        print(f"GeoTIFF estandarizados encontrados: {len(standardized_index)}")
        selected = choose_pairs(df, standardized_index)
    except Exception as exc:
        sys.exit(f"ERROR preparando pares: {exc}")
    if selected.empty:
        sys.exit(
            "ERROR: no quedaron pares seleccionables. Verifica que las rutas del CSV "
            "correspondan por nombre a los GeoTIFF estandarizados."
        )
    selected.to_csv(OUT_SELECTED_CSV, index=False, encoding="utf-8-sig")
    print(f"Pares seleccionados (siguiente fecha por cada escena inicial): {len(selected)}")
    print("Las rutas del CSV se relacionan con las copias estandarizadas por nombre exacto de archivo.")
    print("Se alinearán las 7 bandas de la imagen final a la grilla inicial.")
    print("No se modificarán los GeoTIFF de entrada.")
    print("")

    successes, errors = [], []
    total = len(selected)
    for i, (_, row) in enumerate(selected.iterrows(), 1):
        try:
            rec = process_pair(row)
            successes.append(rec)
        except Exception as exc:
            errors.append({
                "archivo_inicial": row.get("archivo_inicial", ""),
                "archivo_final": row.get("archivo_final", ""),
                "fecha_inicial": row.get("fecha_inicial", ""),
                "fecha_final": row.get("fecha_final", ""),
                "error": str(exc)[:1000],
            })
        if i % 25 == 0 or i == total:
            print(f"Avance: {i}/{total} | correctos: {len(successes)} | errores: {len(errors)}")

    pd.DataFrame(successes).to_csv(OUT_SUMMARY_CSV, index=False, encoding="utf-8-sig")
    if errors:
        pd.DataFrame(errors).to_csv(OUT_ERRORS_CSV, index=False, encoding="utf-8-sig")
    elif OUT_ERRORS_CSV.exists():
        OUT_ERRORS_CSV.unlink()

    print("\n" + "=" * 76)
    print("RESUMEN DE ETAPA 6")
    print("=" * 76)
    print(f"Pares seleccionados: {len(selected)}")
    print(f"Pares procesados correctamente: {len(successes)}")
    print(f"Errores: {len(errors)}")
    print(f"CSV de pares seleccionados: {OUT_SELECTED_CSV}")
    print(f"Resumen de índices/cambios: {OUT_SUMMARY_CSV}")
    print(f"Carpeta de resultados: {OUT_ROOT / 'pares'}")
    if errors:
        print(f"Detalle de errores: {OUT_ERRORS_CSV}")
    print("\nNOTA: cambios.tif cuenta cuántos de los cuatro índices disminuyeron (0-4).")
    print("No constituye por sí solo una etiqueta de deforestación.")


if __name__ == "__main__":
    main()
