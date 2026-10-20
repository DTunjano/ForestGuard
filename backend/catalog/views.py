from django.db.models.deletion import ProtectedError
from drf_spectacular.utils import OpenApiExample, extend_schema, extend_schema_view
from rest_framework import filters, parsers, serializers, viewsets

from .models import PipelineModel, SatelliteImage, StudyArea
from .serializers import PipelineModelSerializer, SatelliteImageSerializer, StudyAreaSerializer


@extend_schema_view(
    list=extend_schema(tags=["Áreas de estudio"], summary="Listar mis áreas"),
    create=extend_schema(
        tags=["Áreas de estudio"], summary="Crear área de estudio",
        examples=[OpenApiExample("Área", value={
            "name": "Sector norte", "department": "Cundinamarca", "municipality": "Bogotá",
            "description": "Zona de seguimiento",
        }, request_only=True)],
    ),
    retrieve=extend_schema(tags=["Áreas de estudio"], summary="Consultar área"),
    update=extend_schema(tags=["Áreas de estudio"], summary="Reemplazar área"),
    partial_update=extend_schema(tags=["Áreas de estudio"], summary="Modificar área"),
    destroy=extend_schema(tags=["Áreas de estudio"], summary="Eliminar área", description="No se puede eliminar un área con imágenes asociadas."),
)
class StudyAreaViewSet(viewsets.ModelViewSet):
    serializer_class = StudyAreaSerializer
    queryset = StudyArea.objects.all()
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("name", "department", "municipality")
    ordering_fields = ("name", "created_at")

    def get_queryset(self):
        return StudyArea.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def perform_destroy(self, instance):
        try:
            instance.delete()
        except ProtectedError as exc:
            raise serializers.ValidationError("El área tiene imágenes asociadas.") from exc


@extend_schema_view(
    list=extend_schema(tags=["Imágenes satelitales"], summary="Listar mis imágenes"),
    create=extend_schema(
        tags=["Imágenes satelitales"], summary="Cargar GeoTIFF Sentinel-2",
        description=(
            "Envíe `multipart/form-data` con el archivo `.tif` o `.tiff`, `study_area`, `name`, "
            "`acquisition_date` (AAAA-MM-DD) y `reflectance_scale` (`fraction` o `divide_10000`). "
            "Indique `scl_factor` 1 o 10000 solo si existe SCL. El GeoTIFF debe estar georreferenciado "
            "y describir las bandas B2, B3, B4, B5, B8, B11 y B12; SCL es opcional. "
            "La carga valida estructura y metadatos, no garantiza píxeles útiles para el análisis."
        ),
        request={"multipart/form-data": SatelliteImageSerializer},
    ),
    retrieve=extend_schema(tags=["Imágenes satelitales"], summary="Consultar imagen"),
    destroy=extend_schema(tags=["Imágenes satelitales"], summary="Eliminar imagen", description="No se puede eliminar una imagen vinculada a un análisis."),
)
class SatelliteImageViewSet(viewsets.ModelViewSet):
    serializer_class = SatelliteImageSerializer
    queryset = SatelliteImage.objects.all()
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("name", "study_area__name")
    ordering_fields = ("name", "acquisition_date", "uploaded_at")
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


@extend_schema_view(
    list=extend_schema(tags=["Modelos"], summary="Listar modelos activos"),
    retrieve=extend_schema(tags=["Modelos"], summary="Consultar modelo"),
)
class PipelineModelViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PipelineModel.objects.filter(active=True)
    serializer_class = PipelineModelSerializer
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("name", "version")
    ordering_fields = ("name", "version")
