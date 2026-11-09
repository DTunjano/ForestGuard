from pathlib import Path

from django.db import transaction
from django.http import Http404
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Analysis, ResultArtifact, V9Evaluation
from .v9_evaluation import MAX_REFERENCE_BYTES, PREDICTION_PATH, evaluate_reference
from .views import artifact_file


class ReferenceUploadSerializer(serializers.Serializer):
    reference = serializers.FileField(help_text="GeoTIFF UInt8 de una banda alineado a v9: 0 sin pérdida, 1 pérdida, 255 sin etiqueta.")
    reference_source = serializers.CharField(max_length=300, help_text="Fuente verificable de las etiquetas del intervalo.")
    independent_reference = serializers.BooleanField(help_text="Confirma que las etiquetas corresponden al intervalo y son independientes del entrenamiento y ajuste de v9.")

    def validate_reference(self, value):
        if Path(value.name).suffix.lower() not in {".tif", ".tiff"}:
            raise serializers.ValidationError("Selecciona un archivo .tif o .tiff.")
        if value.size > MAX_REFERENCE_BYTES:
            raise serializers.ValidationError("La referencia no puede superar 64 MB.")
        return value

    def validate_independent_reference(self, value):
        if not value:
            raise serializers.ValidationError("Confirma la independencia de las etiquetas y que corresponden al intervalo.")
        return value


class EvaluationMetricsSerializer(serializers.Serializer):
    jaccard = serializers.FloatField(allow_null=True)
    precision = serializers.FloatField(allow_null=True)
    sensibilidad = serializers.FloatField(allow_null=True)
    verdaderos_positivos = serializers.IntegerField()
    falsos_positivos = serializers.IntegerField()
    falsos_negativos = serializers.IntegerField()
    verdaderos_negativos = serializers.IntegerField()
    pixeles_evaluados = serializers.IntegerField()
    pixeles_prediccion_validos = serializers.IntegerField()


class V9EvaluationSerializer(serializers.ModelSerializer):
    metrics = EvaluationMetricsSerializer()

    class Meta:
        model = V9Evaluation
        fields = ("reference_name", "reference_source", "metrics", "evaluated_at")


class EvaluationResponseSerializer(serializers.Serializer):
    evaluation = V9EvaluationSerializer(allow_null=True)


class V9EvaluationView(APIView):
    permission_model = Analysis
    parser_classes = [MultiPartParser]

    def prediction(self, request, artifact_id):
        artifact = get_object_or_404(
            ResultArtifact, pk=artifact_id, kind="raster",
            analysis__owner=request.user, analysis__status=Analysis.Status.COMPLETED,
            analysis__model__version="v9",
        )
        if not PREDICTION_PATH.fullmatch(artifact.relative_path):
            raise Http404
        return artifact

    @extend_schema(
        tags=["Resultados"], summary="Consultar evaluación de v9 contra una referencia",
        responses={200: EvaluationResponseSerializer, 404: OpenApiResponse(description="Predicción no disponible.")},
    )
    def get(self, request, artifact_id):
        artifact = self.prediction(request, artifact_id)
        evaluation = V9Evaluation.objects.filter(prediction=artifact).first()
        return Response(EvaluationResponseSerializer({"evaluation": evaluation}).data)

    @extend_schema(
        tags=["Resultados"], summary="Evaluar y guardar la coincidencia de v9 con una referencia",
        description=("Evalúa la clase 1 dentro de la cuadrícula compartida. Se conserva una evaluación por predicción. "
                     "Una referencia válida reemplaza la evaluación anterior. El archivo de referencia se usa durante la solicitud."),
        request={"multipart/form-data": ReferenceUploadSerializer},
        responses={
            200: EvaluationResponseSerializer,
            400: OpenApiResponse(description="Referencia inválida o sin píxeles comparables."),
            404: OpenApiResponse(description="Predicción no disponible."),
        },
    )
    def post(self, request, artifact_id):
        if not request.user.has_perm("analyses.view_analysis"):
            raise PermissionDenied()
        artifact = self.prediction(request, artifact_id)
        form = ReferenceUploadSerializer(data=request.data)
        form.is_valid(raise_exception=True)
        upload = form.validated_data["reference"]
        try:
            metrics = evaluate_reference(artifact_file(artifact), upload)
        except ValueError as exc:
            raise serializers.ValidationError({"reference": str(exc)}) from exc
        with transaction.atomic():
            locked = get_object_or_404(ResultArtifact.objects.select_for_update(), pk=artifact.pk)
            evaluation, _ = V9Evaluation.objects.update_or_create(
                prediction=locked,
                defaults={
                    "reference_name": upload.name,
                    "reference_source": form.validated_data["reference_source"],
                    "metrics": metrics,
                },
            )
        return Response(EvaluationResponseSerializer({"evaluation": evaluation}).data)
