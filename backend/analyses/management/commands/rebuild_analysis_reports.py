"""Rebuild reports from existing summaries and PNGs without running the pipeline."""

from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from analyses.models import Analysis, ResultArtifact
from analyses.reports import write_report


class Command(BaseCommand):
    help = "Actualizar el PDF de análisis completados sin recalcular imágenes ni métricas"

    def add_arguments(self, parser):
        parser.add_argument("--analysis-id", type=int, action="append", required=True)

    def handle(self, *args, **options):
        for analysis_id in dict.fromkeys(options["analysis_id"]):
            with transaction.atomic():
                analysis = (
                    Analysis.objects.select_for_update()
                    .select_related("study_area")
                    .filter(pk=analysis_id, status=Analysis.Status.COMPLETED)
                    .first()
                )
                if analysis is None:
                    raise CommandError(f"El análisis {analysis_id} no existe o no está completado")
                media = Path(settings.MEDIA_ROOT).resolve()
                root = (media / "results" / str(analysis_id)).resolve()
                if not root.is_relative_to(media) or not root.is_dir() or not analysis.summary:
                    raise CommandError(f"Faltan resultados o resumen del análisis {analysis_id}")
                target = root / "reporte.pdf"
                write_report(analysis, analysis.summary, target)
                ResultArtifact.objects.update_or_create(
                    analysis=analysis,
                    relative_path="reporte.pdf",
                    defaults={"kind": "report", "size_bytes": target.stat().st_size},
                )
            self.stdout.write(self.style.SUCCESS(f"Análisis {analysis_id}: PDF actualizado"))
