import shutil
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404, HttpResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import (
    OpenApiExample,
    extend_schema,
    extend_schema_view,
)
from rest_framework import decorators, filters, mixins, serializers, viewsets
from rest_framework.negotiation import DefaultContentNegotiation
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Analysis, ResultArtifact
from .raster_preview import raster_metadata, render_preview
from .serializers import AnalysisSerializer


def artifact_file(artifact):
    root = (Path(settings.MEDIA_ROOT) / "results" / str(artifact.analysis_id)).resolve()
    target = (root / artifact.relative_path).resolve()
    if not target.is_relative_to(root) or not target.is_file():
        raise Http404
    return target


class BinaryResponseContentNegotiation(DefaultContentNegotiation):
    """Binary success responses bypass DRF rendering; DRF renders only errors."""

    def select_renderer(self, request, renderers, format_suffix=None):
        return renderers[0], renderers[0].media_type


class ArtifactPreviewView(APIView):
    content_negotiation_class = BinaryResponseContentNegotiation

    @extend_schema(
        tags=["Resultados"], summary="Ver PNG de un artefacto raster",
        description=("Solo se necesita el ID del artefacto, disponible en `artifacts` del análisis. "
                     "El servidor elige automáticamente el tamaño de la miniatura. "
                     "El PNG es privado y requiere autenticación."),
        responses={(200, "image/png"): OpenApiTypes.BINARY},
    )
    def get(self, request, artifact_id):
        artifact = get_object_or_404(
            ResultArtifact, pk=artifact_id, analysis__owner=request.user, kind="raster",
        )
        return HttpResponse(render_preview(artifact_file(artifact)), content_type="image/png")


class ArtifactDownloadView(APIView):
    content_negotiation_class = BinaryResponseContentNegotiation

    @extend_schema(
        tags=["Resultados"], summary="Descargar archivo por ID de artefacto",
        description="El ID del artefacto identifica el análisis y se obtiene en `artifacts`. Solo el propietario puede descargarlo.",
        responses={(200, "application/octet-stream"): OpenApiTypes.BINARY},
    )
    def get(self, request, artifact_id):
        artifact = get_object_or_404(ResultArtifact, pk=artifact_id, analysis__owner=request.user)
        target = artifact_file(artifact)
        return FileResponse(target.open("rb"), as_attachment=True, filename=target.name)


class ArtifactMetadataView(APIView):
    @extend_schema(
        tags=["Resultados"], summary="Consultar metadatos por ID de artefacto",
        description="Solo admite artefactos raster del usuario autenticado.",
        responses={200: OpenApiTypes.OBJECT},
    )
    def get(self, request, artifact_id):
        artifact = get_object_or_404(
            ResultArtifact, pk=artifact_id, analysis__owner=request.user, kind="raster",
        )
        return Response(raster_metadata(artifact_file(artifact)))


@extend_schema_view(
    list=extend_schema(tags=["Análisis"], summary="Listar mis análisis"),
    create=extend_schema(
        tags=["Análisis"], summary="Analizar una imagen o comparar varias",
        description=(
            "Crea un trabajo en estado `queued`; el worker local debe estar en ejecución para procesarlo. "
            "Elige un área de `GET /api/v1/study-areas/` y los IDs de las escenas de `GET /api/v1/images/`. "
            "`image_ids` admite de 1 a 32 imágenes distintas de la misma área y con fechas diferentes; "
            "se ordenan por fecha. Una imagen produce índices descriptivos automáticamente y no usa v9, "
            "aunque se envíe `model_id`. Dos o más imágenes permiten comparar fechas. "
            "`model_id` es opcional y, para varias fechas, requiere escenas con SCL; "
            "el modelo solo se aplica a intervalos compatibles con su contrato. "
            "Los resultados exploratorios requieren revisión humana."
        ),
        examples=[
            OpenApiExample("Análisis de una imagen", value={
                "name": "Índices de una escena", "study_area": 1, "image_ids": [1],
            }, request_only=True),
            OpenApiExample("Comparación de dos fechas", value={
                "name": "Comparación histórica", "study_area": 1, "image_ids": [1, 2],
                "description": "Escenas del mismo sector",
            }, request_only=True),
            OpenApiExample("Comparación con v9", value={
                "name": "Clasificación exploratoria", "study_area": 1,
                "image_ids": [1, 2], "model_id": 1,
            }, request_only=True),
        ],
    ),
    retrieve=extend_schema(tags=["Análisis"], summary="Consultar estado y resumen"),
    destroy=extend_schema(
        tags=["Análisis"], summary="Eliminar análisis terminado",
        description="Elimina el registro y sus resultados. Los trabajos `queued` o `running` no se pueden eliminar.",
    ),
)
class AnalysisViewSet(mixins.CreateModelMixin, mixins.DestroyModelMixin, mixins.ListModelMixin,
                      mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = AnalysisSerializer
    queryset = Analysis.objects.all()
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("name", "study_area__name")
    ordering_fields = ("name", "created_at", "status")

    def get_queryset(self):
        return (Analysis.objects.filter(owner=self.request.user)
                .select_related("study_area", "model")
                .prefetch_related("scene_links__image", "artifacts"))

    def perform_destroy(self, instance):
        if instance.status in (Analysis.Status.QUEUED, Analysis.Status.RUNNING):
            raise serializers.ValidationError("El análisis debe terminar antes de eliminarlo.")
        media_root = Path(settings.MEDIA_ROOT).resolve()
        folders = [(media_root / name / str(instance.pk)).resolve() for name in ("results", "normalized")]
        if any(not folder.is_relative_to(media_root) for folder in folders):
            raise serializers.ValidationError("Ruta de resultado inválida.")
        instance.delete()
        for folder in folders:
            if folder.is_dir():
                shutil.rmtree(folder)

    @extend_schema(exclude=True)
    @decorators.action(detail=True, methods=["get"], url_path="artifacts/(?P<artifact_id>[0-9]+)/download")
    def download(self, request, pk=None, artifact_id=None):
        _, target = self._artifact_file(artifact_id)
        return FileResponse(target.open("rb"), as_attachment=True, filename=target.name)

    @extend_schema(exclude=True)
    @decorators.action(detail=True, methods=["get"], url_path="artifacts/(?P<artifact_id>[0-9]+)/metadata")
    def metadata(self, request, pk=None, artifact_id=None):
        artifact, target = self._artifact_file(artifact_id)
        if artifact.kind != "raster":
            raise Http404
        return Response(raster_metadata(target))

    @extend_schema(exclude=True)
    @decorators.action(detail=True, methods=["get"], url_path="artifacts/(?P<artifact_id>[0-9]+)/preview")
    def preview(self, request, pk=None, artifact_id=None):
        artifact, target = self._artifact_file(artifact_id)
        if artifact.kind != "raster":
            raise Http404
        size = serializers.IntegerField(min_value=64, max_value=1024)
        try:
            max_size = size.run_validation(request.query_params.get("max_size", 768))
        except serializers.ValidationError as exc:
            raise serializers.ValidationError({"max_size": exc.detail}) from exc
        return HttpResponse(render_preview(target, max_size), content_type="image/png")

    def _artifact_file(self, artifact_id):
        analysis = self.get_object()
        artifact = ResultArtifact.objects.filter(analysis=analysis, pk=artifact_id).first()
        if artifact is None:
            raise Http404
        return artifact, artifact_file(artifact)
