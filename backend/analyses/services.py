"""DB-backed single-job worker and the boundary to the portable pipeline."""

import json
import subprocess
import sys
from pathlib import Path

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import Analysis, ResultArtifact
from .reports import write_report


def claim_next_analysis():
    with transaction.atomic():
        analysis = (Analysis.objects.select_for_update(skip_locked=True)
                    .filter(status=Analysis.Status.QUEUED).order_by("created_at").first())
        if analysis is None:
            return None
        analysis.status = Analysis.Status.RUNNING
        analysis.started_at = timezone.now()
        analysis.save(update_fields=("status", "started_at"))
        return analysis.pk


def process_analysis(analysis_id):
    analysis = Analysis.objects.prefetch_related("scene_links__image").get(pk=analysis_id)
    root = Path(settings.PIPELINE_ROOT)
    result_root = Path(settings.MEDIA_ROOT) / "results" / str(analysis.pk)
    normalized = Path(settings.MEDIA_ROOT) / "normalized" / str(analysis.pk)
    normalized.mkdir(parents=True, exist_ok=True)
    scenes = []
    try:
        for link in analysis.scene_links.all():
            image = link.image
            destination = normalized / f"scene_{link.order:02d}.tif"
            command = [sys.executable, str(root / "src" / "normalizar_entrada_forestguard.py"),
                       "--entrada", image.file.path, "--salida", str(destination),
                       "--escala-reflectancia", "fraccion" if image.reflectance_scale == "fraction" else "dividir_10000"]
            if image.scl_factor is None:
                command.append("--sin-scl")
            else:
                command += ["--factor-scl", str(image.scl_factor)]
            subprocess.run(command, check=True, capture_output=True, text=True, timeout=1800)
            scenes += [f"{image.acquisition_date.isoformat()}={destination}"]
        command = [sys.executable, str(root / "src" / "forestguard_pipeline.py"),
                   "--salida", str(result_root)]
        for scene in scenes:
            command += ["--escena", scene]
        if analysis.model_id:
            model_path = (root / analysis.model.relative_path).resolve()
            if not model_path.is_relative_to(root.resolve()) or not model_path.is_file():
                raise ValueError("Modelo configurado fuera del paquete o no disponible")
            command += ["--modelo", str(model_path)]
        subprocess.run(command, check=True, capture_output=True, text=True, timeout=7200)
        summary = json.loads((result_root / "resumen_serie.json").read_text(encoding="utf-8"))
        write_report(analysis, summary, result_root / "reporte.pdf")
        artifacts = []
        for path in result_root.rglob("*"):
            if path.is_file() and path.suffix.lower() in {".tif", ".json", ".pdf"}:
                artifacts.append(ResultArtifact(
                    analysis=analysis, relative_path=str(path.relative_to(result_root)),
                    kind={".tif": "raster", ".json": "metadata", ".pdf": "report"}[path.suffix.lower()],
                    size_bytes=path.stat().st_size,
                ))
        with transaction.atomic():
            ResultArtifact.objects.bulk_create(artifacts)
            analysis.summary = summary
            analysis.status = Analysis.Status.COMPLETED
            analysis.finished_at = timezone.now()
            analysis.save(update_fields=("summary", "status", "finished_at"))
    except Exception as exc:
        detail = (exc.stderr[-1500:] if isinstance(exc, subprocess.CalledProcessError) and exc.stderr else str(exc))
        analysis.status = Analysis.Status.FAILED
        analysis.error_message = detail[:2000]
        analysis.finished_at = timezone.now()
        analysis.save(update_fields=("status", "error_message", "finished_at"))
        raise
