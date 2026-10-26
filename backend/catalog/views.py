from django.db import IntegrityError, transaction
from django.db.models import Count
from django.db.models.deletion import ProtectedError
from drf_spectacular.utils import (
    OpenApiExample,
    OpenApiParameter,
    extend_schema,
    extend_schema_view,
)
from rest_framework import decorators, filters, parsers, serializers, status, viewsets
from rest_framework.response import Response

from accounts.rbac import ModelManagementPermission

from .models import PipelineModel, SatelliteImage, StudyArea
from .serializers import (
    AdminPipelineModelSerializer,
    ModelPackageSerializer,
    PipelineModelRegistrationSerializer,
    PipelineModelSerializer,
    SatelliteImageSerializer,
    StudyAreaSerializer,
)


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
    list=extend_schema(tags=["Imágenes satelitales"], summary="Listar mis imágenes",
                       parameters=[OpenApiParameter("study_area", int, description="Filtrar por área propia.")]),
    create=extend_schema(
        tags=["Imágenes satelitales"], summary="Cargar GeoTIFF Sentinel-2",
        description=(
            "Envíe `multipart/form-data` con `study_area` y el archivo `.tif` o `.tiff`; `name` es opcional. "
            "La fecha de adquisición se obtiene de metadatos del archivo o de su nombre, nunca de la fecha de carga. "
            "El servidor detecta `reflectance_scale` y `scl_factor` y los devuelve como campos de solo lectura. "
            "El GeoTIFF debe estar georreferenciado "
            "y describir las bandas B2, B3, B4, B5, B8, B11 y B12; SCL es opcional. "
            "La carga exige una fecha inequívoca, escala detectable y al menos 60 % de píxeles válidos. "
            "La cobertura se comprueba antes de guardar el archivo y se devuelve como valid_coverage_percent."
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
        queryset = SatelliteImage.objects.filter(owner=self.request.user).select_related("study_area")
        area = self.request.query_params.get("study_area")
        if area is not None:
            try:
                area_id = serializers.IntegerField(min_value=1, max_value=2**63 - 1).run_validation(area)
            except serializers.ValidationError as exc:
                raise serializers.ValidationError({"study_area": exc.detail}) from exc
            queryset = queryset.filter(study_area_id=area_id)
        return queryset

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


@extend_schema_view(
    list=extend_schema(tags=["Modelos"], summary="Administrar modelos activos e inactivos",
                       parameters=[OpenApiParameter("active", str, enum=["true", "false"], description="Omitir para todas las disponibilidades.")]),
    retrieve=extend_schema(tags=["Modelos"], summary="Consultar registro de un modelo"),
    create=extend_schema(tags=["Modelos"], summary="Registrar paquete de modelo instalado",
        description="Solo registra paquetes confiables instalados y verificados en el servidor. No recibe archivos, rutas ni métricas del cliente. Una versión solo se registra una vez.",
        request=PipelineModelRegistrationSerializer, responses={201: AdminPipelineModelSerializer},
        examples=[OpenApiExample("ForestGuard v9", value={"package_key": "v9", "name": "ForestGuard cambio histórico", "active": True}, request_only=True)]),
    partial_update=extend_schema(tags=["Modelos"], summary="Editar nombre, descripción o disponibilidad",
        description="Desactivar impide elegir el modelo en nuevos análisis. Los trabajos existentes y sus resultados se conservan. La versión, algoritmo, paquete y métricas no se modifican."),
    destroy=extend_schema(tags=["Modelos"], summary="Eliminar modelo sin análisis asociados",
        description="Solo elimina el registro del catálogo, sin borrar el paquete instalado. Si tiene análisis, desactívelo para conservar la historia."),
)
class AdminPipelineModelViewSet(viewsets.ModelViewSet):
    queryset = PipelineModel.objects.all()
    serializer_class = AdminPipelineModelSerializer
    permission_classes = [ModelManagementPermission]
    http_method_names = ("get", "post", "patch", "delete", "head", "options")
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("name", "version")
    ordering_fields = ("name", "version", "created_at", "active")

    def get_queryset(self):
        queryset = PipelineModel.objects.annotate(analysis_count=Count("analysis")).order_by("-created_at")
        active = self.request.query_params.get("active")
        if active is not None:
            if active not in ("true", "false"):
                raise serializers.ValidationError({"active": "Elija true o false."})
            queryset = queryset.filter(active=active == "true")
        return queryset

    def create(self, request, *args, **kwargs):
        serializer = PipelineModelRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                instance = serializer.save()
        except IntegrityError as exc:
            raise serializers.ValidationError({"package_key": "Esta versión ya está registrada."}) from exc
        return Response(AdminPipelineModelSerializer(instance).data, status=status.HTTP_201_CREATED)

    def perform_destroy(self, instance):
        try:
            instance.delete()
        except ProtectedError as exc:
            raise serializers.ValidationError("El modelo tiene análisis asociados. Puede desactivarlo para conservar sus resultados.") from exc

    @extend_schema(tags=["Modelos"], summary="Consultar paquetes instalados para registrar", responses={200: ModelPackageSerializer(many=True)})
    @decorators.action(detail=False, methods=["get"], url_path="packages")
    def packages(self, request):
        from .model_registry import PACKAGES, installed_package

        result = []
        for key, package in PACKAGES.items():
            error = ""
            try:
                installed_package(key)
            except serializers.ValidationError:
                error = "El paquete no está disponible o requiere revisar su integridad en el servidor."
            result.append({"key": key, "name": package["name"], "version": package["version"],
                           "registered_id": PipelineModel.objects.filter(version=package["version"]).values_list("pk", flat=True).first(),
                           "available": not bool(error), "message": error})
        return Response(result)
