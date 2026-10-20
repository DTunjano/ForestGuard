from django.db.models.deletion import ProtectedError
from rest_framework import parsers, serializers, viewsets

from .models import PipelineModel, SatelliteImage, StudyArea
from .serializers import PipelineModelSerializer, SatelliteImageSerializer, StudyAreaSerializer


class StudyAreaViewSet(viewsets.ModelViewSet):
    serializer_class = StudyAreaSerializer
    queryset = StudyArea.objects.all()

    def get_queryset(self):
        return StudyArea.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def perform_destroy(self, instance):
        try:
            instance.delete()
        except ProtectedError as exc:
            raise serializers.ValidationError("El área tiene imágenes asociadas.") from exc


class SatelliteImageViewSet(viewsets.ModelViewSet):
    serializer_class = SatelliteImageSerializer
    queryset = SatelliteImage.objects.all()
    parser_classes = (parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser)
    http_method_names = ("get", "post", "delete", "head", "options")

    def get_queryset(self):
        return SatelliteImage.objects.filter(owner=self.request.user).select_related("study_area")

    def perform_destroy(self, instance):
        try:
            instance.delete()
        except ProtectedError as exc:
            raise serializers.ValidationError("La imagen pertenece a un análisis.") from exc
        instance.file.delete(save=False)


class PipelineModelViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PipelineModel.objects.filter(active=True)
    serializer_class = PipelineModelSerializer
