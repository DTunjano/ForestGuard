from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from analyses.models import Analysis


class Command(BaseCommand):
    help = "Mark abandoned running analyses as failed after an operator-selected age"

    def add_arguments(self, parser):
        parser.add_argument("--older-than-hours", type=int, default=24)
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        hours = options["older_than_hours"]
        if hours < 1:
            raise ValueError("older-than-hours debe ser al menos 1")
        cutoff = timezone.now() - timedelta(hours=hours)
        with transaction.atomic():
            stale = list(Analysis.objects.select_for_update().filter(
                Q(heartbeat_at__lt=cutoff) | Q(heartbeat_at__isnull=True, started_at__lt=cutoff),
                status=Analysis.Status.RUNNING,
            ))
            if not options["dry_run"]:
                now = timezone.now()
                for analysis in stale:
                    analysis.status = Analysis.Status.FAILED
                    analysis.error_message = "El trabajador se interrumpió; revise los registros antes de repetir."
                    analysis.finished_at = now
                Analysis.objects.bulk_update(stale, ("status", "error_message", "finished_at"))
        self.stdout.write(f"Análisis antiguos encontrados: {len(stale)}; dry-run={options['dry_run']}")
