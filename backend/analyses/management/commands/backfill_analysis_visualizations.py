"""Generate PNG artifacts for analyses completed before PNG export was added."""

from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from analyses.models import Analysis, ResultArtifact
from analyses.visualizations import write_visualizations


class Command(BaseCommand):
    help = "Generate downloadable PNG artifacts for one or more completed analyses"

    def add_arguments(self, parser):
        parser.add_argument("--analysis-id", type=int, action="append", required=True,
                            help="ID de análisis terminado; puede repetirse")

    def handle(self, *args, **options):
        for analysis_id in options["analysis_id"]:
            analysis = Analysis.objects.filter(pk=analysis_id, status=Analysis.Status.COMPLETED).first()
            if analysis is None:
                raise CommandError(f"El análisis {analysis_id} no existe o no está completado")
            output = Path(settings.MEDIA_ROOT) / "results" / str(analysis_id)
            normalized = Path(settings.MEDIA_ROOT) / "normalized" / str(analysis_id)
            scene_paths = [normalized / f"scene_{link.order:02d}.tif"
                           for link in analysis.scene_links.order_by("order")]
            if not output.is_dir() or not scene_paths or any(not path.is_file() for path in scene_paths):
                raise CommandError(f"Faltan resultados o escenas normalizadas del análisis {analysis_id}")
            write_visualizations(analysis.summary, output, scene_paths)
            count = 0
            for path in output.rglob("*.png"):
                ResultArtifact.objects.update_or_create(
                    analysis=analysis, relative_path=path.relative_to(output).as_posix(),
                    defaults={"kind": "visualization", "size_bytes": path.stat().st_size},
                )
                count += 1
            self.stdout.write(self.style.SUCCESS(f"Análisis {analysis_id}: {count} PNG registrados"))
