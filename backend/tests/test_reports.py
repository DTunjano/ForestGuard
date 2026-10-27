"""Report completeness, update-on-download, privacy and failure preservation."""

from io import StringIO
from unittest.mock import patch

import numpy as np
import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from PIL import Image
from rest_framework.test import APIClient

from analyses.models import Analysis, ResultArtifact
from analyses.report_catalog import report_plates
from analyses.reports import _image_parts, ensure_current_report, write_report
from catalog.models import StudyArea


def test_catalog_keeps_every_standalone_png_in_reading_order(tmp_path):
    names = [
        "fechas/2024-03-01/resumen_fecha.png",
        "visualizacion_comparativa.png",
        "fechas/2024-01-01/resumen_fecha_contraste.png",
        "visualizacion_individual.png",
        "intervalos/2024-01-01_2024-03-01/resumen_cambio.png",
        "fechas/2024-01-01/original_rgb.png",
        "other/custom.png",
        "fechas/2024-01-01/NDVI.png",
        "fechas/2024-01-01/NDVI.tif",
    ]
    for name in names:
        target = tmp_path / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.touch()
    plates = report_plates(tmp_path)
    assert len(plates) == 7
    assert plates[0].relative_path == "visualizacion_individual.png"
    assert [plate.section for plate in plates] == [
        "overview",
        "individual",
        "individual",
        "individual",
        "comparisons_overview",
        "comparison",
        "other",
    ]
    assert "Color natural" in next(
        plate.caption for plate in plates if plate.path.stem == "original_rgb"
    )
    assert "no un cambio temporal" in next(
        plate.caption for plate in plates if "contraste" in plate.path.stem
    )


def test_long_overview_preserves_complete_pixel_rows(tmp_path):
    source = np.zeros((1260, 1080, 3), dtype="uint8")
    source[:675] = [255, 0, 0]
    source[675:] = [0, 255, 0]
    target = tmp_path / "visualizacion_individual.png"
    Image.fromarray(source).save(target)
    parts = list(_image_parts(target))
    assert len(parts) == 2
    assert [(item.imageWidth, item.imageHeight) for item in parts] == [(1080, 675), (1080, 585)]


def make_analysis(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    owner = get_user_model().objects.create_user(
        username="report-owner", email="report@example.test"
    )
    area = StudyArea.objects.create(name="Bosque de prueba", owner=owner)
    analysis = Analysis.objects.create(
        name="Informe completo",
        owner=owner,
        study_area=area,
        status="completed",
        summary={
            "escenas": [{"fecha": "2024-01-01", "indices": {}, "fraccion_valida": 0.9}],
            "intervalos": [],
        },
    )
    root = tmp_path / "results" / str(analysis.pk)
    root.mkdir(parents=True)
    Image.new("RGB", (1080, 685), "green").save(root / "visualizacion_individual.png")
    (root / "reporte.pdf").write_bytes(b"%PDF-old-version")
    artifact = ResultArtifact.objects.create(
        analysis=analysis, relative_path="reporte.pdf", kind="report", size_bytes=16
    )
    return analysis, root, artifact


@pytest.mark.django_db(transaction=True)
def test_download_updates_old_report_once_and_preserves_private_results(settings, tmp_path):
    analysis, root, artifact = make_analysis(settings, tmp_path)
    png_before = (root / "visualizacion_individual.png").read_bytes()
    other = get_user_model().objects.create_user(
        username="report-other", email="other-report@example.test"
    )
    client = APIClient()
    client.force_authenticate(other)
    assert client.get(f"/api/v1/artifacts/{artifact.pk}/download/").status_code == 404
    assert not (root / ".reporte.version").exists()
    client.force_authenticate(analysis.owner)
    with patch("analyses.reports.write_report", wraps=write_report) as writer:
        response = client.get(f"/api/v1/artifacts/{artifact.pk}/download/")
        assert response.status_code == 200
        assert b"".join(response.streaming_content).startswith(b"%PDF")
        response.close()
        response = client.get(f"/api/v1/analyses/{analysis.pk}/export/?format=png")
        assert response.status_code == 200
        response.close()
        assert writer.call_count == 1
        analysis.description = "Descripción actualizada"
        analysis.save(update_fields=["description"])
        ensure_current_report(analysis)
        assert writer.call_count == 2
    artifact.refresh_from_db()
    assert artifact.size_bytes == (root / "reporte.pdf").stat().st_size
    assert (root / "visualizacion_individual.png").read_bytes() == png_before
    original_summary = analysis.summary
    call_command("rebuild_analysis_reports", "--analysis-id", analysis.pk, stdout=StringIO())
    analysis.refresh_from_db()
    assert analysis.summary == original_summary
    assert analysis.artifacts.filter(kind="report").count() == 1


@pytest.mark.django_db(transaction=True)
def test_export_registers_missing_pdf_even_with_prefetched_artifacts(settings, tmp_path):
    from io import BytesIO
    from zipfile import ZipFile

    analysis, root, artifact = make_analysis(settings, tmp_path)
    artifact.delete()
    (root / "reporte.pdf").unlink()
    client = APIClient()
    client.force_authenticate(analysis.owner)
    response = client.get(f"/api/v1/analyses/{analysis.pk}/export/?format=png")
    assert response.status_code == 200
    with ZipFile(BytesIO(b"".join(response.streaming_content))) as archive:
        assert archive.read("reporte.pdf").startswith(b"%PDF")
    response.close()
    assert analysis.artifacts.filter(relative_path="reporte.pdf").count() == 1


@pytest.mark.django_db
def test_failed_report_build_keeps_previous_pdf(settings, tmp_path):
    analysis, root, _ = make_analysis(settings, tmp_path)
    target = root / "reporte.pdf"
    original = target.read_bytes()
    with patch(
        "analyses.reports.ReportDocument.multiBuild", side_effect=RuntimeError("controlled failure")
    ):
        with pytest.raises(RuntimeError, match="controlled failure"):
            write_report(analysis, analysis.summary, target)
    assert target.read_bytes() == original
    assert not list(root.glob("tmp*.pdf"))
