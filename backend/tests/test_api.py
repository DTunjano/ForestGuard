
import numpy as np
import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rasterio.io import MemoryFile
from rasterio.transform import from_origin
from rest_framework.test import APIClient

from analyses.models import Analysis
from analyses.services import claim_next_analysis, process_analysis
from catalog.models import PipelineModel, StudyArea


def make_geotiff(scl=True):
    descriptions = ["B2", "B3", "B4", "B5", "B8", "B11", "B12"]
    if scl:
        descriptions.append("SCL")
    data = np.full((len(descriptions), 8, 8), 0.4, dtype="float32")
    if scl:
        data[-1] = 4
    with MemoryFile() as mem:
        with mem.open(driver="GTiff", width=8, height=8, count=len(descriptions),
                      dtype="float32", crs="EPSG:32618", transform=from_origin(500000, 500000, 10, 10)) as dst:
            dst.write(data)
            for index, description in enumerate(descriptions, 1):
                dst.set_band_description(index, description)
        return mem.read()


@pytest.mark.django_db
def test_register_login_logout_and_permissions():
    client = APIClient()
    registered = client.post("/api/v1/auth/register/", {
        "username": "analyst", "email": "a@example.com", "password": "StrongPass123!",
    }, format="json")
    assert registered.status_code == 201
    user = get_user_model().objects.get(username="analyst")
    assert user.role == "analyst" and not user.is_project_admin
    token = client.post("/api/v1/auth/token/", {"username": "analyst", "password": "StrongPass123!"}, format="json")
    assert token.status_code == 200
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.data['access']}")
    assert client.get("/api/v1/auth/me/").status_code == 200
    assert client.get("/api/v1/admin/users/").status_code == 403
    assert client.post("/api/v1/auth/logout/", {"refresh": token.data["refresh"]}, format="json").status_code == 204
    assert client.post("/api/v1/auth/token/refresh/", {"refresh": token.data["refresh"]}, format="json").status_code == 401


@pytest.mark.django_db
def test_upload_and_analysis_contract(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    user = get_user_model().objects.create_user(username="owner", email="owner@example.com", password="StrongPass123!")
    other = get_user_model().objects.create_user(username="other", email="other@example.com", password="StrongPass123!")
    area = StudyArea.objects.create(owner=user, name="Meta 05")
    client = APIClient()
    client.force_authenticate(user=user)
    response = client.post("/api/v1/images/", {
        "study_area": area.pk, "name": "Escena inicial", "acquisition_date": "2024-05-17",
        "reflectance_scale": "fraction", "scl_factor": 1,
        "file": SimpleUploadedFile("scene.tif", make_geotiff(), content_type="image/tiff"),
    }, format="multipart")
    assert response.status_code == 201, response.data
    first_id = response.data["id"]
    response = client.post("/api/v1/images/", {
        "study_area": area.pk, "name": "Escena final", "acquisition_date": "2024-09-24",
        "reflectance_scale": "fraction", "scl_factor": 1,
        "file": SimpleUploadedFile("scene2.tif", make_geotiff(), content_type="image/tiff"),
    }, format="multipart")
    assert response.status_code == 201, response.data
    second_id = response.data["id"]
    model = PipelineModel.objects.create(name="ForestGuard", version="v9", algorithm="RF",
                                          relative_path="model/modelo_exploratorio.joblib", active=True)
    result = client.post("/api/v1/analyses/", {
        "name": "Cambio", "study_area": area.pk, "image_ids": [second_id, first_id], "model_id": model.pk,
    }, format="json")
    assert result.status_code == 201, result.data
    assert [item["date"] for item in result.data["images"]] == ["2024-05-17", "2024-09-24"]
    assert client.post("/api/v1/analyses/", {"name": "Repetido", "study_area": area.pk,
                                             "image_ids": [first_id, first_id]}, format="json").status_code == 400
    client.force_authenticate(user=other)
    assert client.get(f"/api/v1/analyses/{result.data['id']}/").status_code == 404
    assert client.get(f"/api/v1/images/{first_id}/").status_code == 404


@pytest.mark.django_db
def test_invalid_raster_rejected(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    user = get_user_model().objects.create_user(username="owner", password="StrongPass123!")
    area = StudyArea.objects.create(owner=user, name="Área")
    client = APIClient()
    client.force_authenticate(user=user)
    response = client.post("/api/v1/images/", {
        "study_area": area.pk, "name": "No raster", "acquisition_date": "2024-01-01",
        "reflectance_scale": "fraction", "file": SimpleUploadedFile("fake.tif", b"not a raster"),
    }, format="multipart")
    assert response.status_code == 400


@pytest.mark.django_db(transaction=True)
def test_worker_runs_packaged_pipeline_for_one_scene(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    user = get_user_model().objects.create_user(username="worker-owner", password="StrongPass123!")
    area = StudyArea.objects.create(owner=user, name="Sector sintético")
    client = APIClient()
    client.force_authenticate(user=user)
    uploaded = client.post("/api/v1/images/", {
        "study_area": area.pk, "name": "Escena", "acquisition_date": "2024-05-17",
        "reflectance_scale": "fraction", "scl_factor": 1,
        "file": SimpleUploadedFile("scene.tif", make_geotiff(), content_type="image/tiff"),
    }, format="multipart")
    assert uploaded.status_code == 201, uploaded.data
    queued = client.post("/api/v1/analyses/", {
        "study_area": area.pk, "name": "Índices", "image_ids": [uploaded.data["id"]],
    }, format="json")
    assert queued.status_code == 201, queued.data
    analysis_id = claim_next_analysis()
    assert analysis_id == queued.data["id"]
    process_analysis(analysis_id)
    analysis = Analysis.objects.get(pk=analysis_id)
    assert analysis.status == Analysis.Status.COMPLETED
    assert analysis.summary["modalidad"] == "indices_una_fecha"
    assert analysis.artifacts.filter(relative_path="resumen_serie.json").exists()
    assert analysis.artifacts.filter(relative_path="reporte.pdf", kind="report").exists()
    assert (tmp_path / "results" / str(analysis_id) / "reporte.pdf").read_bytes().startswith(b"%PDF")
    report = analysis.artifacts.get(relative_path="reporte.pdf")
    response = client.get(f"/api/v1/analyses/{analysis_id}/artifacts/{report.pk}/download/")
    assert response.status_code == 200
    assert client.delete(f"/api/v1/analyses/{analysis_id}/").status_code == 204
    assert not (tmp_path / "results" / str(analysis_id)).exists()


@pytest.mark.django_db(transaction=True)
def test_worker_runs_two_scene_model(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    user = get_user_model().objects.create_user(username="pair-owner", password="StrongPass123!")
    area = StudyArea.objects.create(owner=user, name="Par sintético")
    model = PipelineModel.objects.create(
        name="ForestGuard cambio histórico", version="v9", algorithm="Random Forest",
        relative_path="model/modelo_exploratorio.joblib", active=True,
    )
    client = APIClient()
    client.force_authenticate(user=user)
    ids = []
    for date_value in ("2024-05-17", "2024-09-24"):
        response = client.post("/api/v1/images/", {
            "study_area": area.pk, "name": date_value, "acquisition_date": date_value,
            "reflectance_scale": "fraction", "scl_factor": 1,
            "file": SimpleUploadedFile("scene.tif", make_geotiff(), content_type="image/tiff"),
        }, format="multipart")
        assert response.status_code == 201, response.data
        ids.append(response.data["id"])
    queued = client.post("/api/v1/analyses/", {
        "study_area": area.pk, "name": "Par", "image_ids": ids, "model_id": model.pk,
    }, format="json")
    assert queued.status_code == 201, queued.data
    analysis_id = claim_next_analysis()
    process_analysis(analysis_id)
    analysis = Analysis.objects.get(pk=analysis_id)
    assert analysis.status == Analysis.Status.COMPLETED
    assert len(analysis.summary["intervalos"]) == 1
    assert analysis.summary["intervalos"][0]["estado_clasificacion"] == "ejecutada"
