
import numpy as np
import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.utils import timezone
from rasterio.io import MemoryFile
from rasterio.transform import from_origin
from rest_framework.test import APIClient

from analyses.models import Analysis
from analyses.services import claim_next_analysis, process_analysis, recover_stale_analyses
from catalog.models import PipelineModel, StudyArea


def make_geotiff(scl=True, descriptions=None, offset=0, spectral_value=0.4, scl_value=4):
    if descriptions is None:
        descriptions = ["B2", "B3", "B4", "B5", "B8", "B11", "B12"]
        if scl:
            descriptions.append("SCL")
    data = np.full((len(descriptions), 8, 8), spectral_value, dtype="float32")
    if scl:
        data[-1] = scl_value
    with MemoryFile() as mem:
        with mem.open(driver="GTiff", width=8, height=8, count=len(descriptions),
                      dtype="float32", crs="EPSG:32618", transform=from_origin(500000, 500000, 10, 10)) as dst:
            dst.write(data)
            if offset:
                dst.offsets = [offset] * len(descriptions)
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
        "file": SimpleUploadedFile("scene_2024_05_17.tif", make_geotiff(), content_type="image/tiff"),
    }, format="multipart")
    assert response.status_code == 201, response.data
    first_id = response.data["id"]
    response = client.post("/api/v1/images/", {
        "study_area": area.pk, "name": "Escena final", "acquisition_date": "2024-09-24",
        "reflectance_scale": "fraction", "scl_factor": 1,
        "file": SimpleUploadedFile("scene_2024_09_24.tif", make_geotiff(), content_type="image/tiff"),
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
    single = client.post("/api/v1/analyses/", {
        "name": "Índices de una imagen", "study_area": area.pk,
        "image_ids": [first_id], "model_id": model.pk,
    }, format="json")
    assert single.status_code == 201, single.data
    assert single.data["study_area"] == area.pk
    assert single.data["model_id"] is None
    assert len(single.data["images"]) == 1
    other_area = StudyArea.objects.create(owner=user, name="Otra área")
    assert client.post("/api/v1/analyses/", {
        "name": "Área incorrecta", "study_area": other_area.pk, "image_ids": [first_id],
    }, format="json").status_code == 400
    elsewhere = client.post("/api/v1/images/", {
        "study_area": other_area.pk,
        "file": SimpleUploadedFile("scene_2024_10_17.tif", make_geotiff(), content_type="image/tiff"),
    }, format="multipart")
    assert elsewhere.status_code == 201, elsewhere.data
    assert client.post("/api/v1/analyses/", {
        "name": "Áreas mezcladas", "study_area": area.pk,
        "image_ids": [first_id, elsewhere.data["id"]],
    }, format="json").status_code == 400
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


@pytest.mark.django_db
def test_upload_rejects_scenes_without_usable_pixels(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    user = get_user_model().objects.create_user(username="empty-owner", password="StrongPass123!")
    area = StudyArea.objects.create(owner=user, name="Área")
    client = APIClient()
    client.force_authenticate(user=user)

    for data, scl_factor in (
        (make_geotiff(spectral_value=np.nan), 1),
        (make_geotiff(scl_value=7), 1),
        (make_geotiff(scl=False, spectral_value=np.nan), None),
    ):
        payload = {
            "study_area": area.pk, "name": "Sin datos", "acquisition_date": "2024-01-01",
            "reflectance_scale": "fraction", "file": SimpleUploadedFile("empty_2024_01_01.tif", data),
        }
        if scl_factor is not None:
            payload["scl_factor"] = scl_factor
        response = client.post("/api/v1/images/", payload, format="multipart")
        assert response.status_code == 400, response.data
        assert "píxeles válidos" in str(response.data["file"]) or "inferir la escala" in str(response.data["file"])
    assert not (tmp_path / "uploads").exists()


@pytest.mark.django_db
def test_upload_infers_date_radiometry_and_scl(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    user = get_user_model().objects.create_user(username="automatic-owner", password="StrongPass123!")
    area = StudyArea.objects.create(owner=user, name="Área")
    client = APIClient()
    client.force_authenticate(user=user)

    fractional = client.post("/api/v1/images/", {
        "study_area": area.pk,
        "file": SimpleUploadedFile(
            "img__20261021060558__S2__2025_01_19__3734.tif",
            make_geotiff(scl_value=.0004), content_type="image/tiff"),
        "acquisition_date": "2026-10-21", "reflectance_scale": "divide_10000", "scl_factor": 1,
    }, format="multipart")
    assert fractional.status_code == 201, fractional.data
    assert fractional.data["acquisition_date"] == "2025-01-19"
    assert fractional.data["reflectance_scale"] == "fraction"
    assert fractional.data["scl_factor"] == 10000
    assert fractional.data["name"] == "img__20261021060558__S2__2025_01_19__3734"

    scaled = client.post("/api/v1/images/", {
        "study_area": area.pk,
        "file": SimpleUploadedFile("S2A_MSIL2A_20251008T050000.tif",
                                   make_geotiff(spectral_value=4000, scl_value=4),
                                   content_type="image/tiff"),
    }, format="multipart")
    assert scaled.status_code == 201, scaled.data
    assert scaled.data["acquisition_date"] == "2025-10-08"
    assert scaled.data["reflectance_scale"] == "divide_10000"
    assert scaled.data["scl_factor"] == 1

    unknown_date = client.post("/api/v1/images/", {
        "study_area": area.pk,
        "file": SimpleUploadedFile("scene.tif", make_geotiff(), content_type="image/tiff"),
    }, format="multipart")
    assert unknown_date.status_code == 400
    assert "fecha de adquisición" in str(unknown_date.data["file"])


@pytest.mark.django_db
def test_band_aliases_and_invalid_metadata(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    user = get_user_model().objects.create_user(
        username="bands-owner", email="bands@example.com", password="StrongPass123!",
    )
    area = StudyArea.objects.create(owner=user, name="Bandas")
    client = APIClient()
    client.force_authenticate(user=user)

    def upload(data):
        return client.post("/api/v1/images/", {
            "study_area": area.pk, "name": "Escena", "acquisition_date": "2024-05-17",
            "reflectance_scale": "fraction", "file": SimpleUploadedFile("scene_2024_05_17.tif", data),
        }, format="multipart")

    names = ["B02", "B03", "B04", "B05", "B08", "B11", "B12"]
    accepted = upload(make_geotiff(scl=False, descriptions=names))
    assert accepted.status_code == 201, accepted.data
    assert accepted.data["band_descriptions"] == ["B2", "B3", "B4", "B5", "B8", "B11", "B12"]
    duplicated = upload(make_geotiff(scl=False, descriptions=names + ["B02"]))
    assert duplicated.status_code == 400
    scaled = upload(make_geotiff(scl=False, descriptions=names, offset=100))
    assert scaled.status_code == 400


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
        "file": SimpleUploadedFile("scene_2024_05_17.tif", make_geotiff(), content_type="image/tiff"),
    }, format="multipart")
    assert uploaded.status_code == 201, uploaded.data
    queued = client.post("/api/v1/analyses/", {
        "name": "Índices", "study_area": area.pk, "image_ids": [uploaded.data["id"]],
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
    assert analysis.artifacts.filter(relative_path="visualizacion_individual.png", kind="visualization").exists()
    assert analysis.artifacts.filter(relative_path="fechas/2024-05-17/NDVI.png", kind="visualization").exists()
    assert (tmp_path / "results" / str(analysis_id) / "reporte.pdf").read_bytes().startswith(b"%PDF")
    report = analysis.artifacts.get(relative_path="reporte.pdf")
    response = client.get(f"/api/v1/analyses/{analysis_id}/artifacts/{report.pk}/download/")
    assert response.status_code == 200
    response.close()
    ndvi = analysis.artifacts.get(relative_path="fechas/2024-05-17/NDVI.tif")
    ndvi_png = analysis.artifacts.get(relative_path="fechas/2024-05-17/NDVI.png")
    detail = client.get(f"/api/v1/analyses/{analysis_id}/")
    assert detail.status_code == 200
    raster_entry = next(item for item in detail.data["artifacts"] if item["id"] == ndvi.pk)
    assert raster_entry["label"] == "NDVI · 2024-05-17 (TIF)"
    assert raster_entry["png_artifact_id"] == ndvi_png.pk
    assert raster_entry["png_download_url"].endswith(f"/api/v1/artifacts/{ndvi_png.pk}/download/")
    assert client.get(f"/api/v1/analyses/{analysis_id}/artifacts/{ndvi.pk}/metadata/").status_code == 200
    preview = client.get(f"/api/v1/analyses/{analysis_id}/artifacts/{ndvi.pk}/preview/")
    assert preview.status_code == 200 and preview.content.startswith(b"\x89PNG")
    board = analysis.artifacts.get(relative_path="visualizacion_individual.png")
    image = client.get(f"/api/v1/artifacts/{board.pk}/download/", HTTP_ACCEPT="application/octet-stream")
    assert image.status_code == 200
    assert b"".join(image.streaming_content).startswith(b"\x89PNG")
    image.close()
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
            "file": SimpleUploadedFile(f"scene_{date_value.replace('-', '_')}.tif", make_geotiff(), content_type="image/tiff"),
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
    assert analysis.artifacts.filter(relative_path="visualizacion_comparativa.png", kind="visualization").exists()


@pytest.mark.django_db(transaction=True)
def test_worker_marks_unexpected_report_error_failed(settings, tmp_path, monkeypatch):
    settings.MEDIA_ROOT = tmp_path
    user = get_user_model().objects.create_user(username="failure-owner", password="StrongPass123!")
    area = StudyArea.objects.create(owner=user, name="Error")
    client = APIClient()
    client.force_authenticate(user=user)
    image = client.post("/api/v1/images/", {
        "study_area": area.pk, "name": "Escena", "acquisition_date": "2024-05-17",
        "reflectance_scale": "fraction", "scl_factor": 1,
        "file": SimpleUploadedFile("scene_2024_05_17.tif", make_geotiff(), content_type="image/tiff"),
    }, format="multipart")
    queued = client.post("/api/v1/analyses/", {
        "study_area": area.pk, "name": "Falla", "image_ids": [image.data["id"]],
    }, format="json")
    assert queued.status_code == 201
    analysis_id = claim_next_analysis()

    def fail_report(*_args):
        raise RuntimeError("Falla simulada de reporte")

    monkeypatch.setattr("analyses.services.write_report", fail_report)
    with pytest.raises(RuntimeError, match="Falla simulada"):
        process_analysis(analysis_id)
    analysis = Analysis.objects.get(pk=analysis_id)
    assert analysis.status == Analysis.Status.FAILED
    assert analysis.finished_at is not None
    assert "Falla simulada" in analysis.error_message


@pytest.mark.django_db
def test_stale_job_recovery_requires_explicit_execution():
    from datetime import timedelta

    user = get_user_model().objects.create_user(username="stale-owner", password="StrongPass123!")
    area = StudyArea.objects.create(owner=user, name="Área")
    analysis = Analysis.objects.create(
        owner=user, study_area=area, name="Abandonado", status=Analysis.Status.RUNNING,
        started_at=timezone.now() - timedelta(hours=25),
    )
    call_command("fail_stale_analyses", older_than_hours=24, dry_run=True)
    analysis.refresh_from_db()
    assert analysis.status == Analysis.Status.RUNNING
    call_command("fail_stale_analyses", older_than_hours=24)
    analysis.refresh_from_db()
    assert analysis.status == Analysis.Status.FAILED


@pytest.mark.django_db
def test_worker_recovers_stale_heartbeat_without_interrupting_live_job():
    from datetime import timedelta

    user = get_user_model().objects.create_user(username="recovery-owner", password="StrongPass123!")
    area = StudyArea.objects.create(owner=user, name="Recuperación")
    old = timezone.now() - timedelta(hours=2)
    stale = Analysis.objects.create(owner=user, study_area=area, name="Abandonado",
                                    status=Analysis.Status.RUNNING, started_at=old, heartbeat_at=old)
    active = Analysis.objects.create(owner=user, study_area=area, name="Activo",
                                     status=Analysis.Status.RUNNING, started_at=old,
                                     heartbeat_at=timezone.now())
    assert recover_stale_analyses(15) == 1
    stale.refresh_from_db()
    active.refresh_from_db()
    assert stale.status == Analysis.Status.FAILED and stale.finished_at is not None
    assert active.status == Analysis.Status.RUNNING


@pytest.mark.django_db
def test_search_and_ordering_keep_user_scope():
    owner = get_user_model().objects.create_user(username="search-owner", email="owner@search.test", password="StrongPass123!")
    other = get_user_model().objects.create_user(username="search-other", email="other@search.test", password="StrongPass123!")
    StudyArea.objects.create(owner=owner, name="Zeta Meta")
    StudyArea.objects.create(owner=owner, name="Alfa Meta")
    StudyArea.objects.create(owner=other, name="Oculta Meta")
    client = APIClient()
    client.force_authenticate(user=owner)
    response = client.get("/api/v1/study-areas/?search=Meta&ordering=name")
    assert response.status_code == 200
    assert [item["name"] for item in response.data["results"]] == ["Alfa Meta", "Zeta Meta"]
