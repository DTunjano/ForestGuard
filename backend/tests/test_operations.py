import json
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.management import call_command
from django.core.management.base import CommandError
from django.utils import timezone

from analyses.models import Analysis
from catalog.models import SatelliteImage, StudyArea


@pytest.mark.django_db
def test_backup_and_explicit_retention(settings, tmp_path, monkeypatch):
    settings.MEDIA_ROOT = tmp_path / "media"
    user = get_user_model().objects.create_user(username="retention", password="StrongPass123!")
    area = StudyArea.objects.create(owner=user, name="Área")
    old = timezone.now() - timedelta(days=40)
    analysis = Analysis.objects.create(owner=user, study_area=area, name="Antiguo",
                                       status=Analysis.Status.COMPLETED, finished_at=old)
    result = settings.MEDIA_ROOT / "results" / str(analysis.pk) / "result.tif"
    result.parent.mkdir(parents=True)
    result.write_bytes(b"raster")
    image = SatelliteImage(owner=user, study_area=area, name="Sin uso", acquisition_date=old.date(),
                           size_bytes=4, reflectance_scale="fraction", band_descriptions=[],
                           crs="EPSG:32618", width=1, height=1)
    image.file.save("old.tif", ContentFile(b"file"), save=True)
    SatelliteImage.objects.filter(pk=image.pk).update(uploaded_at=old)

    def fake_dump(_command, *, stdout, **_kwargs):
        stdout.write(b"PGDMP-test-dump")

    monkeypatch.setattr("analyses.management.commands.backup_forestguard.subprocess.run", fake_dump)
    destination = tmp_path / "backups"
    call_command("backup_forestguard", destination=destination)
    backup = next(destination.iterdir())
    manifest = json.loads((backup / "manifest.json").read_text(encoding="utf-8"))
    assert "database.dump" in manifest["files_sha256"]
    assert (backup / "media" / "results" / str(analysis.pk) / "result.tif").read_bytes() == b"raster"
    call_command("verify_forestguard_backup", backup_dir=backup)

    call_command("prune_analysis_data", older_than_days=30, include_unused_uploads=True)
    assert Analysis.objects.filter(pk=analysis.pk).exists()
    assert SatelliteImage.objects.filter(pk=image.pk).exists()
    call_command("prune_analysis_data", older_than_days=30, include_unused_uploads=True,
                 execute=True, backup_dir=backup)
    assert not Analysis.objects.filter(pk=analysis.pk).exists()
    assert not SatelliteImage.objects.filter(pk=image.pk).exists()
    assert not result.exists()
    assert not image.file.storage.exists(image.file.name)
    (backup / "database.dump").write_bytes(b"damaged")
    with pytest.raises(CommandError, match="Copia incompleta"):
        call_command("verify_forestguard_backup", backup_dir=backup)


@pytest.mark.django_db
def test_retention_requires_verified_backup(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path / "media"
    user = get_user_model().objects.create_user(username="guarded", password="StrongPass123!")
    area = StudyArea.objects.create(owner=user, name="Área")
    analysis = Analysis.objects.create(owner=user, study_area=area, name="Antiguo",
                                       status=Analysis.Status.FAILED,
                                       finished_at=timezone.now() - timedelta(days=40))
    with pytest.raises(CommandError, match="copia completa"):
        call_command("prune_analysis_data", older_than_days=30, execute=True,
                     backup_dir=tmp_path / "missing")
    assert Analysis.objects.filter(pk=analysis.pk).exists()
