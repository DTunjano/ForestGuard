import subprocess
import sys
from datetime import date
from unittest.mock import Mock

import numpy as np
import pytest
import rasterio
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile
from rasterio.io import MemoryFile
from rasterio.transform import from_origin
from rest_framework.test import APIClient

from analyses.models import Analysis, AnalysisImage
from analyses.services import claim_next_analysis, process_analysis
from catalog.models import PipelineModel, SatelliteImage, StudyArea
from pipeline.src.raster_quality import scan_coverage
from pipeline.src.temporal_policy import require_interval

BANDS = ("B2", "B3", "B4", "B5", "B8", "B11", "B12", "SCL")


def quality_tiff(count, *, last=False, zero=False):
    cube = np.full((8, 10, 10), 0.4, dtype="float32")
    cube[7] = 9
    view = cube[7].reshape(-1)
    view[-count:] = 4 if count else 9
    if not last:
        view[:] = 9
        view[:count] = 4
    if zero:
        cube[:7] = 0
    with MemoryFile() as memory:
        with memory.open(
            driver="GTiff",
            width=10,
            height=10,
            count=8,
            dtype="float32",
            crs="EPSG:32618",
            transform=from_origin(500000, 500000, 10, 10),
        ) as target:
            target.write(cube)
            target.descriptions = BANDS
        return memory.read()


def account():
    user = get_user_model().objects.create_user(
        username="quality_owner", email="quality@example.test"
    )
    area = StudyArea.objects.create(owner=user, name="Área de calidad")
    client = APIClient()
    client.force_authenticate(user)
    return user, area, client


def upload(client, area, acquired, content):
    return client.post(
        "/api/v1/images/",
        {"study_area": area.pk, "file": SimpleUploadedFile(f"scene_{acquired}.tif", content)},
        format="multipart",
    )


@pytest.mark.django_db
@pytest.mark.parametrize("count", [59, 60, 61])
def test_upload_enforces_exact_60_percent_before_saving(settings, tmp_path, count):
    settings.MEDIA_ROOT = tmp_path
    _, area, client = account()
    response = upload(client, area, "2024_01_01", quality_tiff(count))
    if count < 60:
        assert response.status_code == 400
        assert "59.00 %" in str(response.data) and "60 %" in str(response.data)
        assert not SatelliteImage.objects.exists()
        assert not (tmp_path / "uploads").exists()
    else:
        assert response.status_code == 201, response.data
        assert response.data["valid_pixel_count"] == count
        assert response.data["valid_coverage_percent"] == count


def test_quality_excludes_pixels_with_undefined_indices():
    with MemoryFile(quality_tiff(100, zero=True)) as memory, memory.open() as source:
        assert scan_coverage(source, BANDS, scl_factor=1)["valid_pixels"] == 0


@pytest.mark.django_db
def test_legacy_image_is_rejected_before_queuing_and_worker_preflight(
    settings, tmp_path, monkeypatch
):
    settings.MEDIA_ROOT = tmp_path
    user, area, client = account()
    image = SatelliteImage(
        owner=user,
        study_area=area,
        name="Escena con nubes",
        acquisition_date=date(2024, 1, 1),
        size_bytes=1000,
        reflectance_scale="fraction",
        scl_factor=1,
        band_descriptions=list(BANDS),
        crs="EPSG:32618",
        width=10,
        height=10,
    )
    image.file.save("legacy_2024_01_01.tif", ContentFile(quality_tiff(59)))
    result = client.post(
        "/api/v1/analyses/",
        {"name": "Rechazado", "study_area": area.pk, "image_ids": [image.pk]},
        format="json",
    )
    assert result.status_code == 400 and "59.00 %" in str(result.data)
    assert not Analysis.objects.exists()
    # Even a stale queued job cannot bypass the worker's file validation.
    job = Analysis.objects.create(owner=user, study_area=area, name="Antiguo")
    AnalysisImage.objects.create(analysis=job, image=image, order=0)
    subprocess = Mock(side_effect=AssertionError("No debe iniciarse el pipeline"))
    monkeypatch.setattr("analyses.services.subprocess.run", subprocess)
    job_id = claim_next_analysis()
    with pytest.raises(ValueError, match="59.00"):
        process_analysis(job_id)
    subprocess.assert_not_called()
    job.refresh_from_db()
    assert job.status == "failed" and "60 %" in job.error_message
    assert not (tmp_path / "normalized").exists()


@pytest.mark.django_db(transaction=True)
def test_common_coverage_fails_before_any_index_or_model_output(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    _, area, client = account()
    first = upload(client, area, "2024_01_01", quality_tiff(70))
    second = upload(client, area, "2024_03_01", quality_tiff(70, last=True))
    assert first.status_code == second.status_code == 201
    request = client.post(
        "/api/v1/analyses/",
        {
            "name": "Intersección insuficiente",
            "study_area": area.pk,
            "image_ids": [first.data["id"], second.data["id"]],
        },
        format="json",
    )
    assert request.status_code == 201
    job_id = claim_next_analysis()
    with pytest.raises(Exception):
        process_analysis(job_id)
    job = Analysis.objects.get(pk=job_id)
    assert "40.00 %" in job.error_message
    assert "Área común" in job.error_message
    assert not (tmp_path / "results" / str(job_id)).exists()


@pytest.mark.django_db(transaction=True)
def test_long_interval_executes_v9_without_exception_flags(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    _, area, client = account()
    first = upload(client, area, "2024_08_07", quality_tiff(100))
    second = upload(client, area, "2026_10_13", quality_tiff(100))
    assert first.status_code == second.status_code == 201
    model = PipelineModel.objects.create(
        name="ForestGuard",
        version="v9",
        algorithm="RF",
        relative_path="model/modelo_exploratorio.joblib",
        active=True,
    )
    queued = client.post(
        "/api/v1/analyses/",
        {
            "name": "797 días",
            "study_area": area.pk,
            "image_ids": [first.data["id"], second.data["id"]],
            "model_id": model.pk,
        },
        format="json",
    )
    assert queued.status_code == 201
    job_id = claim_next_analysis()
    process_analysis(job_id)
    job = Analysis.objects.get(pk=job_id)
    interval = job.summary["intervalos"][0]
    assert interval["dias"] == 797 and interval["estado_clasificacion"] == "ejecutada"
    assert interval["fuera_intervalo_entrenamiento"] is True
    assert job.summary["politica_temporal"] == {"minimo_dias": 35, "maximo_dias": None}


@pytest.mark.parametrize("days", [35, 330, 331, 797, 10000])
def test_temporal_policy_has_no_maximum(days):
    require_interval(days)


@pytest.mark.parametrize("days", [0, 1, 34])
def test_temporal_policy_keeps_minimum(days):
    with pytest.raises(ValueError, match="35 días"):
        require_interval(days)


@pytest.mark.django_db
def test_api_rejects_34_days_and_accepts_35(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    _, area, client = account()
    ids = [
        upload(client, area, day, quality_tiff(100)).data["id"]
        for day in ("2024_01_01", "2024_02_04", "2024_02_05")
    ]
    body = {"name": "Límite temporal", "study_area": area.pk, "image_ids": ids[:2]}
    response = client.post("/api/v1/analyses/", body, format="json")
    assert response.status_code == 400 and "35 días" in str(response.data)
    assert not Analysis.objects.exists()
    body["image_ids"] = [ids[0], ids[2]]
    assert client.post("/api/v1/analyses/", body, format="json").status_code == 201


@pytest.mark.parametrize(
    "script", ["forestguard_pipeline.py", "inferir_par_ideam.py", "inferir_par_ideam_ventanas.py"]
)
def test_cli_flags_cannot_bypass_minimum(settings, tmp_path, script):
    root = settings.PIPELINE_ROOT
    paths = [tmp_path / "initial.tif", tmp_path / "final.tif"]
    for path in paths:
        with rasterio.open(
            path,
            "w",
            driver="GTiff",
            width=10,
            height=10,
            count=7,
            dtype="float32",
            nodata=np.nan,
            crs="EPSG:32618",
            transform=from_origin(500000, 500000, 10, 10),
        ) as output:
            output.write(np.full((7, 10, 10), 0.4, dtype="float32"))
            output.descriptions = BANDS[:7]
            output.update_tags(
                processing="Copia estandarizada de 7 bandas espectrales tras máscara SCL"
            )
    destination = tmp_path / "output"
    command = [
        sys.executable, "-X", "utf8",
        str(root / "src" / script),
        "--modelo",
        str(root / "model/modelo_exploratorio.joblib"),
        "--salida",
        str(destination),
    ]
    if script == "forestguard_pipeline.py":
        command += [
            "--escena",
            f"2024-01-01={paths[0]}",
            "--escena",
            f"2024-02-04={paths[1]}",
            "--permitir-intervalos-fuera-de-entrenamiento",
        ]
    else:
        command += [
            "--imagen-inicial",
            str(paths[0]),
            "--imagen-final",
            str(paths[1]),
            "--fecha-inicial",
            "2024-01-01",
            "--fecha-final",
            "2024-02-04",
        ]
        if script.endswith("ventanas.py"):
            command.append("--permitir-intervalo-fuera-de-entrenamiento")
    result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", timeout=30)
    assert result.returncode != 0 and "35" in result.stderr
    assert not destination.exists()
