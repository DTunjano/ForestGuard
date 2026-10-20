"""Opt-in integration test for a user-supplied real Sentinel-2 GeoTIFF."""

import os
from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from analyses.models import Analysis
from analyses.services import claim_next_analysis, process_analysis
from catalog.models import PipelineModel, StudyArea


@pytest.mark.django_db(transaction=True)
def test_real_geotiff_scenes(settings, tmp_path):
    source = os.getenv("FORESTGUARD_REAL_TEST_RASTER")
    acquired = os.getenv("FORESTGUARD_REAL_TEST_DATE")
    if not source or not acquired:
        pytest.skip("Defina FORESTGUARD_REAL_TEST_RASTER y FORESTGUARD_REAL_TEST_DATE")
    scenes = [(Path(source), acquired)]
    second_source = os.getenv("FORESTGUARD_REAL_TEST_RASTER_2")
    second_date = os.getenv("FORESTGUARD_REAL_TEST_DATE_2")
    if second_source or second_date:
        assert second_source and second_date, "La segunda escena requiere raster y fecha"
        scenes.append((Path(second_source), second_date))
    scl_factor = os.getenv("FORESTGUARD_REAL_TEST_SCL_FACTOR")
    use_model = os.getenv("FORESTGUARD_REAL_TEST_USE_MODEL") == "1"
    if use_model:
        assert len(scenes) == 2 and scl_factor, "El modelo requiere dos escenas con SCL"
    settings.MEDIA_ROOT = tmp_path
    user = get_user_model().objects.create_user(
        username="real-raster", email="real-raster@example.com", password="StrongPass123!",
    )
    area = StudyArea.objects.create(owner=user, name="Escena real")
    client = APIClient()
    client.force_authenticate(user=user)
    image_ids = []
    for path, date in scenes:
        assert path.is_file(), f"No se encuentra el raster de prueba: {path}"
        payload = {
            "study_area": area.pk, "name": "Escena real", "acquisition_date": date,
            "reflectance_scale": "fraction",
            "file": SimpleUploadedFile(path.name, path.read_bytes(), content_type="image/tiff"),
        }
        if scl_factor:
            payload["scl_factor"] = int(scl_factor)
        uploaded = client.post("/api/v1/images/", payload, format="multipart")
        assert uploaded.status_code == 201, uploaded.data
        image_ids.append(uploaded.data["id"])
    request_data = {
        "study_area": area.pk, "name": "Índices reales", "image_ids": image_ids,
    }
    if use_model:
        model = PipelineModel.objects.create(
            name="ForestGuard cambio histórico", version="v9", algorithm="Random Forest",
            relative_path="model/modelo_exploratorio.joblib", active=True,
        )
        request_data["model_id"] = model.pk
    queued = client.post("/api/v1/analyses/", request_data, format="json")
    assert queued.status_code == 201, queued.data
    analysis_id = claim_next_analysis()
    assert analysis_id == queued.data["id"]
    process_analysis(analysis_id)
    analysis = Analysis.objects.get(pk=analysis_id)
    assert analysis.status == Analysis.Status.COMPLETED
    assert all(scene["pixeles_validos"] > 0 for scene in analysis.summary["escenas"])
    for _, date in scenes:
        assert analysis.artifacts.filter(relative_path=f"fechas/{date}/NDVI.tif").exists()
    if len(scenes) == 2:
        assert len(analysis.summary["intervalos"]) == 1
        if use_model:
            assert analysis.summary["intervalos"][0]["estado_clasificacion"] == "ejecutada"
