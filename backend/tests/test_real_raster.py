"""Opt-in integration test for a user-supplied real Sentinel-2 GeoTIFF."""

import os
from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from analyses.models import Analysis
from analyses.services import claim_next_analysis, process_analysis
from catalog.models import StudyArea


@pytest.mark.django_db(transaction=True)
def test_real_geotiff_one_scene(settings, tmp_path):
    source = os.getenv("FORESTGUARD_REAL_TEST_RASTER")
    acquired = os.getenv("FORESTGUARD_REAL_TEST_DATE")
    if not source or not acquired:
        pytest.skip("Defina FORESTGUARD_REAL_TEST_RASTER y FORESTGUARD_REAL_TEST_DATE")
    path = Path(source)
    assert path.is_file(), f"No se encuentra el raster de prueba: {path}"
    settings.MEDIA_ROOT = tmp_path
    user = get_user_model().objects.create_user(
        username="real-raster", email="real-raster@example.com", password="StrongPass123!",
    )
    area = StudyArea.objects.create(owner=user, name="Escena real")
    client = APIClient()
    client.force_authenticate(user=user)
    uploaded = client.post("/api/v1/images/", {
        "study_area": area.pk, "name": "Escena real", "acquisition_date": acquired,
        "reflectance_scale": "fraction",
        "file": SimpleUploadedFile(path.name, path.read_bytes(), content_type="image/tiff"),
    }, format="multipart")
    assert uploaded.status_code == 201, uploaded.data
    queued = client.post("/api/v1/analyses/", {
        "study_area": area.pk, "name": "Índices reales", "image_ids": [uploaded.data["id"]],
    }, format="json")
    assert queued.status_code == 201, queued.data
    analysis_id = claim_next_analysis()
    assert analysis_id == queued.data["id"]
    process_analysis(analysis_id)
    analysis = Analysis.objects.get(pk=analysis_id)
    assert analysis.status == Analysis.Status.COMPLETED
    assert analysis.summary["escenas"][0]["pixeles_validos"] > 0
    assert analysis.artifacts.filter(relative_path=f"fechas/{acquired}/NDVI.tif").exists()
