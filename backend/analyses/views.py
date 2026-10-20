import shutil
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404
from rest_framework import decorators, mixins, serializers, viewsets

from .models import Analysis, ResultArtifact
from .serializers import AnalysisSerializer


class AnalysisViewSet(mixins.CreateModelMixin, mixins.DestroyModelMixin, mixins.ListModelMixin,
                      mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = AnalysisSerializer
    queryset = Analysis.objects.all()

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
        analysis = self.get_object()
        artifact = ResultArtifact.objects.filter(analysis=analysis, pk=artifact_id).first()
        if artifact is None:
            raise Http404
        root = (Path(settings.MEDIA_ROOT) / "results" / str(analysis.pk)).resolve()
        target = (root / artifact.relative_path).resolve()
        if not target.is_relative_to(root) or not target.is_file():
            raise Http404
        return FileResponse(target.open("rb"), as_attachment=True, filename=target.name)
