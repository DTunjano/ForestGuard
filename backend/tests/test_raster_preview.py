from io import BytesIO

import numpy as np
import pytest
import rasterio
from django.contrib.auth import get_user_model
from PIL import Image
from rasterio.transform import from_origin
from rest_framework.test import APIClient

from analyses.models import Analysis, ResultArtifact
from catalog.models import StudyArea


@pytest.mark.django_db
def test_preview_metadata_and_owner_scope(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    owner = get_user_model().objects.create_user(
        username="map-owner", email="map-owner@example.com", password="StrongPass123!",
    )
    other = get_user_model().objects.create_user(
        username="map-other", email="map-other@example.com", password="StrongPass123!",
    )
    area = StudyArea.objects.create(owner=owner, name="Mapa")
    analysis = Analysis.objects.create(
        owner=owner, study_area=area, name="Mapa", status=Analysis.Status.COMPLETED,
    )
    folder = tmp_path / "results" / str(analysis.pk)
    folder.mkdir(parents=True)
    raster = folder / "clasificacion_cambio_exploratoria.tif"
    data = np.array([[0, 1], [255, 1]], dtype=np.uint8)
    with rasterio.open(raster, "w", driver="GTiff", width=2, height=2, count=1,
                       dtype="uint8", nodata=255, crs="EPSG:32618",
                       transform=from_origin(500000, 500000, 10, 10)) as destination:
        destination.write(data, 1)
    artifact = ResultArtifact.objects.create(
        analysis=analysis, relative_path=raster.name, kind="raster", size_bytes=raster.stat().st_size,
    )
    base = f"/api/v1/analyses/{analysis.pk}/artifacts/{artifact.pk}"
    client = APIClient()
    simple_preview = f"/api/v1/artifacts/{artifact.pk}/preview/"
    denied = client.get(simple_preview, HTTP_ACCEPT="image/png")
    assert denied.status_code == 401 and denied["Content-Type"] == "application/json"
    client.force_authenticate(user=other)
    assert client.get(f"{base}/metadata/").status_code == 404
    assert client.get(f"{base}/preview/").status_code == 404
    assert client.get(simple_preview, HTTP_ACCEPT="image/png").status_code == 404
    assert client.get(f"/api/v1/artifacts/{artifact.pk}/metadata/").status_code == 404
    assert client.get(f"/api/v1/artifacts/{artifact.pk}/download/", HTTP_ACCEPT="application/octet-stream").status_code == 404
    client.force_authenticate(user=owner)
    metadata = client.get(f"{base}/metadata/")
    assert metadata.status_code == 200
    assert metadata.data["crs"] == "EPSG:32618"
    assert len(metadata.data["bounds_wgs84"]) == 4
    assert metadata.data["style"]["type"] == "classes"
    assert client.get(f"/api/v1/artifacts/{artifact.pk}/metadata/").data == metadata.data
    preview = client.get(f"{base}/preview/")
    assert preview.status_code == 200 and preview["Content-Type"] == "image/png"
    swagger_preview = client.get(simple_preview, HTTP_ACCEPT="image/png")
    assert swagger_preview.status_code == 200
    assert swagger_preview["Content-Type"] == "image/png"
    assert swagger_preview.content == preview.content
    artifact_details = client.get(f"/api/v1/analyses/{analysis.pk}/").data["artifacts"][0]
    assert artifact_details["preview_url"].endswith(simple_preview)
    assert artifact_details["download_url"].endswith(f"/api/v1/artifacts/{artifact.pk}/download/")
    assert artifact_details["metadata_url"].endswith(f"/api/v1/artifacts/{artifact.pk}/metadata/")
    download = client.get(f"/api/v1/artifacts/{artifact.pk}/download/", HTTP_ACCEPT="application/octet-stream")
    assert download.status_code == 200
    assert b"".join(download.streaming_content).startswith(b"II*")
    pixels = Image.open(BytesIO(preview.content)).convert("RGBA")
    assert pixels.size == (2, 2)
    assert pixels.getpixel((0, 0)) == (56, 161, 105, 255)
    assert pixels.getpixel((1, 0)) == (231, 76, 60, 255)
    assert pixels.getpixel((0, 1))[3] == 0
    assert client.get(f"{base}/preview/?max_size=2000").status_code == 400
    download.close()


@pytest.mark.django_db
def test_preview_rejects_non_raster_and_escape_path(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    owner = get_user_model().objects.create_user(
        username="map-owner", email="map-owner@example.com", password="StrongPass123!",
    )
    area = StudyArea.objects.create(owner=owner, name="Mapa")
    analysis = Analysis.objects.create(
        owner=owner, study_area=area, name="Mapa", status=Analysis.Status.COMPLETED,
    )
    folder = tmp_path / "results" / str(analysis.pk)
    folder.mkdir(parents=True)
    (folder / "report.json").write_text("{}")
    report = ResultArtifact.objects.create(
        analysis=analysis, relative_path="report.json", kind="metadata", size_bytes=2,
    )
    outside = tmp_path / "results" / "secret.tif"
    outside.write_bytes(b"secret")
    escape = ResultArtifact.objects.create(
        analysis=analysis, relative_path="../secret.tif", kind="raster", size_bytes=6,
    )
    client = APIClient()
    client.force_authenticate(user=owner)
    for artifact in (report, escape):
        base = f"/api/v1/analyses/{analysis.pk}/artifacts/{artifact.pk}"
        assert client.get(f"{base}/preview/").status_code == 404
        assert client.get(f"/api/v1/artifacts/{artifact.pk}/preview/").status_code == 404
        assert client.get(f"{base}/metadata/").status_code == 404
        assert client.get(f"/api/v1/artifacts/{artifact.pk}/metadata/").status_code == 404
    assert client.get(f"/api/v1/analyses/{analysis.pk}/artifacts/{escape.pk}/download/").status_code == 404
    assert client.get(f"/api/v1/artifacts/{escape.pk}/download/").status_code == 404
    document = client.get(f"/api/v1/artifacts/{report.pk}/download/", HTTP_ACCEPT="application/octet-stream")
    assert document.status_code == 200
    document.close()
