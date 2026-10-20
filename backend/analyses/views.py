import shutil
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404, HttpResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import decorators, filters, mixins, serializers, viewsets
from rest_framework.response import Response

from .models import Analysis, ResultArtifact
from .raster_preview import raster_metadata, render_preview
from .serializers import AnalysisSerializer


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

    @decorators.action(detail=True, methods=["get"], url_path="artifacts/(?P<artifact_id>[0-9]+)/download")
    def download(self, request, pk=None, artifact_id=None):
        _, target = self._artifact_file(artifact_id)
        return FileResponse(target.open("rb"), as_attachment=True, filename=target.name)

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    @decorators.action(detail=True, methods=["get"], url_path="artifacts/(?P<artifact_id>[0-9]+)/metadata")
    def metadata(self, request, pk=None, artifact_id=None):
        artifact, target = self._artifact_file(artifact_id)
        if artifact.kind != "raster":
            raise Http404
        return Response(raster_metadata(target))

    @extend_schema(
        parameters=[OpenApiParameter("max_size", int, description="Lado máximo en píxeles (64 a 1024).")],
        responses={(200, "image/png"): OpenApiTypes.BINARY},
    )
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
        root = (Path(settings.MEDIA_ROOT) / "results" / str(analysis.pk)).resolve()
        target = (root / artifact.relative_path).resolve()
        if not target.is_relative_to(root) or not target.is_file():
            raise Http404
        return artifact, target
