"""Create a local PostgreSQL and media backup while the API and worker are stopped."""

import hashlib
import json
import shutil
import subprocess
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from analyses.models import Analysis


def sha256_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_backup(folder, max_age_hours=24):
    folder = Path(folder).resolve()
    try:
        manifest = json.loads((folder / "manifest.json").read_text(encoding="utf-8"))
        created = datetime.fromisoformat(manifest["created_at_utc"])
        files = manifest["files_sha256"]
        if created.tzinfo is None:
            return False
        age = datetime.now(timezone.utc) - created
        if age > timedelta(hours=max_age_hours) or age < -timedelta(minutes=5):
            return False
        if "database.dump" not in files:
            return False
        with (folder / "database.dump").open("rb") as source:
            if source.read(5) != b"PGDMP":
                return False
        for name, expected in files.items():
            path = (folder / name).resolve()
            if not path.is_relative_to(folder) or not path.is_file() or sha256_file(path) != expected:
                return False
    except (OSError, ValueError, KeyError, TypeError):
        return False
    return True


class Command(BaseCommand):
    help = "Back up PostgreSQL and MEDIA_ROOT into a checksummed local directory"

    def add_arguments(self, parser):
        parser.add_argument("--destination", type=Path, required=True)

    def handle(self, *args, **options):
        media_root = Path(settings.MEDIA_ROOT).resolve()
        destination = options["destination"].resolve()
        if destination == media_root or destination.is_relative_to(media_root):
            raise CommandError("El destino de copias no puede estar dentro de MEDIA_ROOT.")
        if Analysis.objects.filter(status=Analysis.Status.RUNNING).exists():
            raise CommandError("Hay análisis en ejecución. Detenga API y worker antes de crear la copia.")
        destination.mkdir(parents=True, exist_ok=True)
        folder = destination / f"forestguard-{datetime.now(timezone.utc):%Y%m%dT%H%M%SZ}"
        if folder.exists():
            raise CommandError("Ya existe una copia con esa marca de tiempo. Reintente en un segundo.")
        temporary = Path(tempfile.mkdtemp(prefix=".forestguard-incomplete-", dir=destination))
        try:
            dump = temporary / "database.dump"
            repo_root = Path(settings.BASE_DIR).parent
            database = settings.DATABASES["default"]
            command = ["docker", "compose", "-f", str(repo_root / "compose.yaml"),
                       "--project-directory", str(repo_root), "exec", "-T", "db",
                       "pg_dump", "-Fc", "-U", database["USER"], "-d", database["NAME"]]
            with dump.open("wb") as output:
                subprocess.run(command, stdout=output, stderr=subprocess.PIPE, check=True, timeout=1800)
            with dump.open("rb") as source:
                if source.read(5) != b"PGDMP":
                    raise CommandError("pg_dump no produjo un archivo PostgreSQL válido.")
            media_target = temporary / "media"
            media_target.mkdir()
            if media_root.exists():
                for source in media_root.rglob("*"):
                    if source.is_symlink():
                        raise CommandError("MEDIA_ROOT contiene un enlace simbólico; revise la copia manualmente.")
                    relative = source.relative_to(media_root)
                    target = media_target / relative
                    if source.is_dir():
                        target.mkdir(parents=True, exist_ok=True)
                    elif source.is_file():
                        target.parent.mkdir(parents=True, exist_ok=True)
                        shutil.copy2(source, target)
            files = {path.relative_to(temporary).as_posix(): sha256_file(path)
                     for path in temporary.rglob("*") if path.is_file()}
            (temporary / "manifest.json").write_text(json.dumps({
                "created_at_utc": datetime.now(timezone.utc).isoformat(),
                "files_sha256": files,
            }, indent=2, ensure_ascii=False), encoding="utf-8")
            temporary.rename(folder)
        except (OSError, subprocess.SubprocessError, CommandError) as exc:
            shutil.rmtree(temporary, ignore_errors=True)
            raise CommandError(f"No se pudo crear la copia: {exc}") from exc
        self.stdout.write(self.style.SUCCESS(f"Copia completa: {folder}"))
