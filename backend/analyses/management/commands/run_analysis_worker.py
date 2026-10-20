import logging
import time

from django.core.management.base import BaseCommand
from django.db import close_old_connections

from analyses.services import claim_next_analysis, process_analysis

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Process queued analyses with the portable pipeline"

    def add_arguments(self, parser):
        parser.add_argument("--once", action="store_true")

    def handle(self, *args, **options):
        while True:
            close_old_connections()
            analysis_id = claim_next_analysis()
            if analysis_id is None:
                if options["once"]:
                    return
                time.sleep(2)
                continue
            try:
                process_analysis(analysis_id)
            except Exception:
                logger.exception("Analysis %s failed", analysis_id)
            if options["once"]:
                return
