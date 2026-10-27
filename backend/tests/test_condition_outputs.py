"""End-to-end real raster rules, previews, PDF, JSON and private ZIP downloads."""

from io import BytesIO
from zipfile import ZipFile

import numpy as np
import pytest
import rasterio
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rasterio.io import MemoryFile
from rasterio.transform import from_origin
from rest_framework.test import APIClient

from analyses.models import Analysis
from analyses.services import claim_next_analysis, process_analysis
from catalog.models import StudyArea


def sample_scene(final=False):
    bands = ["B2", "B3", "B4", "B5", "B8", "B11", "B12", "SCL"]
    cube = np.full((8, 64, 64), 0.1, dtype="float32")
    cube[2] = 0.6 / 9  # NDVI .8
    cube[4] = 0.6
    cube[5] = 0.15
    cube[6] = 0.1
    cube[7] = 4
    cube[2, 32:, 32:] = 0.5  # Other cover in both dates.
    if final:
        cube[6, :32, 32:] = 0.2  # NBR loss .214, with high NDVI.
        cube[2, 32:, :32] = 0.3  # NDVI .333: clearing signal overrides degradation.
    cube[:, -1, -1] = np.nan
    with MemoryFile() as memory:
        with memory.open(
            driver="GTiff",
            width=64,
            height=64,
            count=8,
            dtype="float32",
            crs="EPSG:32618",
            transform=from_origin(500000, 500000, 10, 10),
            nodata=np.nan,
        ) as target:
            target.write(cube)
            target.descriptions = tuple(bands)
        return memory.read()


@pytest.mark.django_db(transaction=True)
def test_real_pipeline_condition_maps_report_and_exports(settings, tmp_path, monkeypatch):
    from analyses import reports

    embedded = []
    original_parts = reports._image_parts

    def capture_plate(path):
        embedded.append(path)
        return original_parts(path)

    monkeypatch.setattr(reports, "_image_parts", capture_plate)
    settings.MEDIA_ROOT = tmp_path
    User = get_user_model()
    owner = User.objects.create_user(username="condition_owner", email="condition@example.test")
    other = User.objects.create_user(
        username="condition_other", email="other-condition@example.test"
    )
    area = StudyArea.objects.create(owner=owner, name="Cobertura controlada de pruebas")
    client = APIClient()
    client.force_authenticate(owner)
    images = []
    for day, final in (("2024_01_01", False), ("2024_03_01", True)):
        response = client.post(
            "/api/v1/images/",
            {
                "study_area": area.pk,
                "file": SimpleUploadedFile(f"scene_{day}.tif", sample_scene(final)),
            },
            format="multipart",
        )
        assert response.status_code == 201, response.data
        images.append(response.data["id"])
    result = client.post(
        "/api/v1/analyses/",
        {"name": "Verificación de cobertura", "study_area": area.pk, "image_ids": images},
        format="json",
    )
    assert result.status_code == 201
    job_id = claim_next_analysis()
    process_analysis(job_id)
    analysis = Analysis.objects.get(pk=job_id)
    assert analysis.status == "completed"
    condition = analysis.summary["intervalos"][0]["condicion"]
    counts = [item["pixeles"] for item in condition["categorias"]]
    assert counts == [1023, 1024, 1024, 1024]
    assert sum(item["porcentaje"] for item in condition["categorias"]) == pytest.approx(100)
    folder = tmp_path / "results" / str(job_id)
    with rasterio.open(folder / "intervalos/2024-01-01_2024-03-01/condicion_bosque.tif") as source:
        values = source.read(1)
        assert source.crs.to_epsg() == 32618 and source.nodata == 255
        assert values[-1, -1] == 255
    artifact = analysis.artifacts.get(
        relative_path="intervalos/2024-01-01_2024-03-01/condicion_bosque.tif"
    )
    response = client.get(f"/api/v1/artifacts/{artifact.pk}/preview/", HTTP_ACCEPT="image/png")
    assert response.status_code == 200
    with Image.open(BytesIO(response.content)) as png:
        assert png.getpixel((5, 5))[:3] == (54, 155, 97)
        assert png.getpixel((40, 5))[:3] == (234, 185, 73)
        assert png.getpixel((5, 40))[:3] == (220, 80, 76)
        assert png.getpixel((63, 63))[3] == 0
    for entry in ("fechas/2024-01-01", "fechas/2024-03-01", "intervalos/2024-01-01_2024-03-01"):
        assert (folder / entry / "resumen_condicion.png").is_file()
    assert (folder / "reporte.pdf").stat().st_size > 10000
    independent_pngs = {path for path in folder.rglob("*.png")
                        if not path.with_suffix(".tif").exists() and not path.with_suffix(".tiff").exists()}
    assert set(embedded) == independent_pngs
    exported = client.get(f"/api/v1/analyses/{job_id}/export/?format=both")
    with ZipFile(BytesIO(b"".join(exported.streaming_content))) as archive:
        names = archive.namelist()
        assert "reporte.pdf" in names
        assert "png/intervalos/2024-01-01_2024-03-01/condicion_bosque.png" in names
        assert "tiff/intervalos/2024-01-01_2024-03-01/condicion_bosque.tif" in names
    exported.close()
    client.force_authenticate(other)
    assert client.get(f"/api/v1/artifacts/{artifact.pk}/download/?format=png").status_code == 404
    assert client.get(f"/api/v1/analyses/{job_id}/export/?format=both").status_code == 404
