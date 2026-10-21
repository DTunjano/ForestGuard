import logging
import time

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import close_old_connections

from analyses.services import claim_next_analysis, process_analysis, recover_stale_analyses

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Process queued analyses with the portable pipeline"

    def add_arguments(self, parser):
        parser.add_argument("--once", action="store_true")

    def handle(self, *args, **options):
        if not options["once"]:
            self.stdout.write("Worker de análisis activo. Esperando trabajos (Ctrl+C para detener).")
        last_recovery = 0.0
        while True:
            close_old_connections()
            if time.monotonic() - last_recovery >= 60 or not last_recovery:
                recovered = recover_stale_analyses(settings.ANALYSIS_STALE_MINUTES)
                if recovered:
                    self.stdout.write(f"Análisis abandonados marcados como fallidos: {recovered}.")
                last_recovery = time.monotonic()
            analysis_id = claim_next_analysis()
            if analysis_id is None:
                if options["once"]:
                    self.stdout.write("No hay análisis pendientes.")
                    return
                try:
                    time.sleep(2)
                except KeyboardInterrupt:
                    self.stdout.write("\nWorker detenido.")
                    return
                continue
            self.stdout.write(f"Procesando análisis {analysis_id}...")
            try:
                process_analysis(analysis_id)
            except Exception:
                logger.exception("Analysis %s failed", analysis_id)
                self.stderr.write(f"El análisis {analysis_id} falló; revise el registro.")
            else:
                self.stdout.write(f"Análisis {analysis_id} completado.")
            if options["once"]:
                return
