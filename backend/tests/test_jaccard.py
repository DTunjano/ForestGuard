from io import BytesIO

import numpy as np
import pytest
import rasterio
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rasterio.transform import from_origin
from rest_framework.test import APIClient

from analyses.models import Analysis, V9Evaluation
from analyses.v9_evaluation import compare_rasters
from catalog.models import PipelineModel, StudyArea


def write_mask(target, values, *, x=500000, reference=False):
    with rasterio.open(
        target, "w", driver="GTiff", count=1, dtype="uint8", nodata=255,
        width=len(values[0]), height=len(values), crs="EPSG:32618",
        transform=from_origin(x, 500000, 10, 10),
    ) as raster:
        raster.write(np.array(values, dtype="uint8"), 1)
        if reference:
            raster.update_tags(source="Referencia independiente de pruebas")


def upload(values, *, x=500000):
    stream = BytesIO()
    write_mask(stream, values, x=x, reference=True)
    return SimpleUploadedFile("referencia.tif", stream.getvalue())


@pytest.mark.django_db
def test_reference_evaluation_validates_and_saves_only_owner_predictions(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    users = get_user_model()
    owner = users.objects.create_user(username="evaluator", email="evaluator@example.test")
    other = users.objects.create_user(username="other", email="other@example.test")
    area = StudyArea.objects.create(owner=owner, name="Área de evaluación")
    model = PipelineModel.objects.create(
        name="Modelo de prueba", version="v9", relative_path="model/modelo_exploratorio.joblib",
    )
    analysis = Analysis.objects.create(
        owner=owner, study_area=area, model=model, name="Par de prueba", status=Analysis.Status.COMPLETED,
    )
    path = "intervalos/2024-01-01_2024-03-01/clasificacion_piloto/clasificacion_cambio_exploratoria.tif"
    target = tmp_path / "results" / str(analysis.pk) / path
    target.parent.mkdir(parents=True)
    write_mask(target, [[1, 1, 0, 0], [255, 1, 0, 255]])
    prediction = analysis.artifacts.create(relative_path=path, kind="raster", size_bytes=target.stat().st_size)
    other_artifact = analysis.artifacts.create(relative_path="otra.tif", kind="raster", size_bytes=0)
    url = f"/api/v1/artifacts/{prediction.pk}/v9-evaluation/"
    client = APIClient()
    client.force_authenticate(owner)
    assert client.get(url).data == {"evaluation": None}
    artifacts = client.get(f"/api/v1/analyses/{analysis.pk}/").data["artifacts"]
    assert next(a for a in artifacts if a["id"] == prediction.pk)["v9_evaluation_url"].endswith(url)
    assert client.get(f"/api/v1/artifacts/{other_artifact.pk}/v9-evaluation/").status_code == 404

    labels = [[1, 0, 1, 0], [1, 255, 0, 255]]

    def evaluate(file, independent=True):
        return client.post(url, {
            "reference": file, "reference_source": "Referencia independiente de pruebas",
            "independent_reference": str(independent).lower(),
        }, format="multipart")

    assert evaluate(upload(labels), independent=False).status_code == 400
    result = evaluate(upload(labels))
    assert result.status_code == 200, result.data
    assert result.data["evaluation"]["metrics"] == {
        "jaccard": pytest.approx(1 / 3), "precision": 0.5, "sensibilidad": 0.5,
        "verdaderos_positivos": 1, "falsos_positivos": 1,
        "falsos_negativos": 1, "verdaderos_negativos": 2,
        "pixeles_evaluados": 5, "pixeles_prediccion_validos": 6,
    }
    for invalid in (
        upload(labels, x=500005),
        upload([[2, 0, 1, 0], [1, 255, 0, 255]]),
        upload([[255] * 4] * 2),
        SimpleUploadedFile("incorrecto.tif", b"not a raster"),
    ):
        assert evaluate(invalid).status_code == 400
    copy = evaluate(SimpleUploadedFile("renombrado.tif", target.read_bytes()))
    assert copy.status_code == 400
    assert "copia de la predicción" in copy.data["reference"]
    assert client.get(url).data == result.data
    replacement = evaluate(upload([[1, 1, 0, 0], [255, 1, 0, 255]]))
    assert replacement.data["evaluation"]["metrics"]["jaccard"] == 1
    assert V9Evaluation.objects.count() == 1

    client.force_authenticate(other)
    assert client.get(url).status_code == 404
    assert evaluate(upload(labels)).status_code == 404


def test_empty_positive_union_is_indeterminate(tmp_path):
    path = tmp_path / "empty.tif"
    write_mask(path, [[0, 0, 255]])
    with rasterio.open(path) as raster:
        result = compare_rasters(raster, raster)
    assert result["pixeles_evaluados"] == 2
    assert result["jaccard"] is result["precision"] is result["sensibilidad"] is None
