"""DB-backed single-job worker and the boundary to the portable pipeline."""

import json
import logging
import subprocess
import sys
import threading
from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from .models import Analysis, ResultArtifact
from .reports import write_report

logger = logging.getLogger(__name__)


def recover_stale_analyses(max_age_minutes=15):
    """Fail jobs whose worker stopped renewing its database heartbeat."""
    cutoff = timezone.now() - timedelta(minutes=max_age_minutes)
    with transaction.atomic():
        stale = list(Analysis.objects.select_for_update(skip_locked=True).filter(
            Q(heartbeat_at__lt=cutoff) | Q(heartbeat_at__isnull=True, started_at__lt=cutoff),
            status=Analysis.Status.RUNNING,
        ))
        now = timezone.now()
        for analysis in stale:
            analysis.status = Analysis.Status.FAILED
            analysis.error_message = "El trabajador dejó de responder; el análisis se marcó como fallido automáticamente."
            analysis.finished_at = now
        Analysis.objects.bulk_update(stale, ("status", "error_message", "finished_at"))
    return len(stale)


def _renew_heartbeat(analysis_id, stop_event):
    from django.db import close_old_connections

    while not stop_event.wait(settings.ANALYSIS_HEARTBEAT_SECONDS):
        try:
            close_old_connections()
            if not Analysis.objects.filter(pk=analysis_id, status=Analysis.Status.RUNNING).update(
                heartbeat_at=timezone.now()
            ):
                return
        except Exception:
            logger.exception("Could not renew heartbeat for analysis %s", analysis_id)
        finally:
            close_old_connections()


def claim_next_analysis():
    with transaction.atomic():
        analysis = (Analysis.objects.select_for_update(skip_locked=True)
                    .filter(status=Analysis.Status.QUEUED).order_by("created_at").first())
        if analysis is None:
            return None
        analysis.status = Analysis.Status.RUNNING
        analysis.started_at = timezone.now()
        analysis.heartbeat_at = analysis.started_at
        analysis.save(update_fields=("status", "started_at", "heartbeat_at"))
        return analysis.pk


def process_analysis(analysis_id):
    analysis = Analysis.objects.prefetch_related("scene_links__image").get(pk=analysis_id)
    if analysis.status != Analysis.Status.RUNNING:
        raise ValueError("El análisis no está en ejecución")
    stop_event = threading.Event()
    heartbeat = threading.Thread(target=_renew_heartbeat, args=(analysis_id, stop_event), daemon=True)
    heartbeat.start()
    root = Path(settings.PIPELINE_ROOT)
    result_root = Path(settings.MEDIA_ROOT) / "results" / str(analysis.pk)
    normalized = Path(settings.MEDIA_ROOT) / "normalized" / str(analysis.pk)
    scenes = []
    try:
        normalized.mkdir(parents=True, exist_ok=True)
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
                    analysis=analysis, relative_path=path.relative_to(result_root).as_posix(),
                    kind={".tif": "raster", ".json": "metadata", ".pdf": "report"}[path.suffix.lower()],
                    size_bytes=path.stat().st_size,
                ))
        with transaction.atomic():
            locked = Analysis.objects.select_for_update().get(pk=analysis_id)
            if locked.status != Analysis.Status.RUNNING:
                raise RuntimeError("El análisis perdió su estado de ejecución")
            ResultArtifact.objects.bulk_create(artifacts)
            analysis.summary = summary
            analysis.status = Analysis.Status.COMPLETED
            analysis.finished_at = timezone.now()
            analysis.save(update_fields=("summary", "status", "finished_at"))
    except Exception as exc:
        detail = (exc.stderr[-1500:] if isinstance(exc, subprocess.CalledProcessError) and exc.stderr else str(exc))
        Analysis.objects.filter(pk=analysis_id, status=Analysis.Status.RUNNING).update(
            status=Analysis.Status.FAILED, error_message=detail[:2000], finished_at=timezone.now(),
        )
        raise
    finally:
        stop_event.set()
        heartbeat.join(timeout=5)
