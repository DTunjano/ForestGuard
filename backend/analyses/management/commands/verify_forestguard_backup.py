from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from .backup_forestguard import verify_backup


class Command(BaseCommand):
    help = "Verify database and media checksums in a ForestGuard backup"

    def add_arguments(self, parser):
        parser.add_argument("--backup-dir", type=Path, required=True)

    def handle(self, *args, **options):
        if not verify_backup(options["backup_dir"], max_age_hours=24 * 365 * 100):
            raise CommandError("Copia incompleta o con archivos modificados.")
        self.stdout.write(self.style.SUCCESS("Copia íntegra."))
