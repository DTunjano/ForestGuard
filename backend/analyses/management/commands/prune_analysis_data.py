"""Explicit, backup-gated retention for completed analyses and unused uploads."""

import shutil
from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from analyses.models import Analysis, AnalysisImage
from catalog.models import SatelliteImage

from .backup_forestguard import verify_backup


class Command(BaseCommand):
    help = "Preview or remove old terminal analyses and optionally unused image uploads"

    def add_arguments(self, parser):
        parser.add_argument("--older-than-days", type=int, required=True)
        parser.add_argument("--include-unused-uploads", action="store_true")
        parser.add_argument("--execute", action="store_true")
        parser.add_argument("--backup-dir", type=Path)

    def handle(self, *args, **options):
        days = options["older_than_days"]
        if days < 1:
            raise CommandError("older-than-days debe ser al menos 1.")
        cutoff = timezone.now() - timedelta(days=days)
        analyses = list(Analysis.objects.filter(
            status__in=(Analysis.Status.COMPLETED, Analysis.Status.FAILED), finished_at__lt=cutoff,
        ).order_by("pk"))
        analysis_ids = [item.pk for item in analyses]
        uploads = []
        if options["include_unused_uploads"]:
            protected = AnalysisImage.objects.exclude(analysis_id__in=analysis_ids).values("image_id")
            uploads = list(SatelliteImage.objects.filter(uploaded_at__lt=cutoff)
                           .exclude(pk__in=protected).order_by("pk"))
        self.stdout.write(f"Análisis terminados: {len(analyses)}; cargas sin uso tras limpieza: {len(uploads)}")
        self.stdout.write(f"IDs de análisis: {analysis_ids[:50]}{'…' if len(analysis_ids) > 50 else ''}")
        self.stdout.write(f"IDs de cargas: {[item.pk for item in uploads[:50]]}{'…' if len(uploads) > 50 else ''}")
        if not options["execute"]:
            self.stdout.write("Simulación: no se eliminó ningún dato. Use --execute y --backup-dir para aplicar.")
            return
        if Analysis.objects.filter(status=Analysis.Status.RUNNING).exists():
            raise CommandError("Hay análisis en ejecución. Detenga el worker antes de aplicar la retención.")
        if not options["backup_dir"] or not verify_backup(options["backup_dir"]):
            raise CommandError("Se requiere --backup-dir con copia completa, íntegra y de menos de 24 horas.")
        media_root = Path(settings.MEDIA_ROOT).resolve()
        for analysis in analyses:
            folders = [(media_root / name / str(analysis.pk)).resolve() for name in ("results", "normalized")]
            if any(not folder.is_relative_to(media_root) for folder in folders):
                raise CommandError("Ruta de resultado fuera de MEDIA_ROOT.")
            analysis.delete()
            for folder in folders:
                if folder.is_dir():
                    shutil.rmtree(folder)
        for image in uploads:
            if image.analysisimage_set.exists():
                continue
            path = Path(image.file.path).resolve()
            if not path.is_relative_to(media_root):
                raise CommandError("Ruta de carga fuera de MEDIA_ROOT.")
            image.delete()
            path.unlink(missing_ok=True)
        self.stdout.write(self.style.SUCCESS("Retención aplicada."))
