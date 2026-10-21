from pathlib import PurePosixPath

from django.db import transaction
from django.urls import reverse
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from catalog.models import PipelineModel, SatelliteImage, StudyArea

from .models import Analysis, AnalysisImage, ResultArtifact


class ResultArtifactSerializer(serializers.ModelSerializer):
    label = serializers.SerializerMethodField(help_text="Nombre legible del resultado y su fecha o intervalo.")
    png_artifact_id = serializers.SerializerMethodField(help_text="ID de la versión PNG del raster, cuando existe.")
    png_download_url = serializers.SerializerMethodField(help_text="Descarga directa del PNG del raster, cuando existe.")
    preview_url = serializers.SerializerMethodField(help_text="Ruta privada de la vista PNG; solo para raster.")
    download_url = serializers.SerializerMethodField(help_text="Ruta privada de descarga del archivo.")
    metadata_url = serializers.SerializerMethodField(help_text="Ruta privada de metadatos; solo para raster.")

    class Meta:
        model = ResultArtifact
        fields = ("id", "kind", "label", "relative_path", "size_bytes", "preview_url", "download_url",
                  "png_artifact_id", "png_download_url", "metadata_url", "created_at")

    @extend_schema_field(serializers.CharField())
    def get_label(self, obj):
        path = PurePosixPath(obj.relative_path)
        if path.name == "reporte.pdf":
            return "Informe completo en PDF"
        if path.name == "resumen_serie.json":
            return "Resumen y métricas en JSON"
        if path.name == "visualizacion_individual.png":
            return "Lámina de resultados individuales en PNG"
        if path.name == "visualizacion_comparativa.png":
            return "Lámina de cambios entre fechas en PNG"
        stem = path.stem.replace("_", " ")
        if len(path.parts) >= 3 and path.parts[0] == "intervalos":
            first, last = path.parts[1].split("_", 1)
            return f"{stem} · {first} a {last} ({path.suffix[1:].upper()})"
        if len(path.parts) >= 3 and path.parts[0] == "fechas":
            return f"{stem} · {path.parts[1]} ({path.suffix[1:].upper()})"
        return path.name

    @extend_schema_field(serializers.IntegerField(allow_null=True))
    def get_png_artifact_id(self, obj):
        if obj.kind != "raster":
            return None
        png_path = str(PurePosixPath(obj.relative_path).with_suffix(".png"))
        artifacts = obj.analysis.artifacts.all()
        return next((item.pk for item in artifacts if item.relative_path == png_path), None)

    @extend_schema_field(serializers.URLField(allow_null=True))
    def get_png_download_url(self, obj):
        png_id = self.get_png_artifact_id(obj)
        return self._absolute_url("artifact-download", png_id) if png_id else None

    @extend_schema_field(serializers.URLField(allow_null=True))
    def get_preview_url(self, obj):
        if obj.kind != "raster":
            return None
        return self._absolute_url("artifact-preview", obj.pk)

    @extend_schema_field(serializers.URLField())
    def get_download_url(self, obj):
        return self._absolute_url("artifact-download", obj.pk)

    @extend_schema_field(serializers.URLField(allow_null=True))
    def get_metadata_url(self, obj):
        if obj.kind != "raster":
            return None
        return self._absolute_url("artifact-metadata", obj.pk)

    def _absolute_url(self, route, artifact_id):
        request = self.context.get("request")
        path = reverse(route, kwargs={"artifact_id": artifact_id})
        return request.build_absolute_uri(path) if request else path


class AnalysisSerializer(serializers.ModelSerializer):
    study_area = serializers.PrimaryKeyRelatedField(
        queryset=StudyArea.objects.all(),
        help_text="ID del área elegida en GET /api/v1/study-areas/. Todas las imágenes deben pertenecer a ella.",
    )
    image_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1), write_only=True,
        help_text="Elige de 1 a 32 IDs de GET /api/v1/images/. Una sola imagen produce índices; varias permiten comparar fechas.",
    )
    model_id = serializers.PrimaryKeyRelatedField(
        source="model", queryset=PipelineModel.objects.filter(active=True), required=False, allow_null=True,
        help_text="Opcional para varias fechas. Con una sola imagen se omite automáticamente y se calculan índices espectrales.",
    )
    images = serializers.SerializerMethodField()
    artifacts = ResultArtifactSerializer(many=True, read_only=True)

    class Meta:
        model = Analysis
        fields = (
            "id", "name", "description", "study_area", "model_id", "image_ids", "images", "status",
            "error_message", "summary", "artifacts", "created_at", "started_at", "finished_at",
        )
        read_only_fields = (
            "id", "images", "status", "error_message", "summary", "artifacts", "created_at",
            "started_at", "finished_at",
        )

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_images(self, obj):
        return [{"id": link.image_id, "date": link.image.acquisition_date.isoformat(), "order": link.order}
                for link in obj.scene_links.all()]

    def validate_study_area(self, value):
        if value.owner_id != self.context["request"].user.pk:
            raise serializers.ValidationError("Área de estudio no disponible.")
        return value

    def validate(self, attrs):
        ids = attrs["image_ids"]
        if not 1 <= len(ids) <= 32 or len(set(ids)) != len(ids):
            raise serializers.ValidationError({"image_ids": "Seleccione de 1 a 32 imágenes distintas."})
        images = list(SatelliteImage.objects.filter(pk__in=ids, owner=self.context["request"].user))
        if len(images) != len(ids):
            raise serializers.ValidationError({"image_ids": "Una o más imágenes no están disponibles."})
        if any(img.study_area_id != attrs["study_area"].pk for img in images):
            raise serializers.ValidationError({"image_ids": "Todas las imágenes deben pertenecer al área seleccionada."})
        dates = [img.acquisition_date for img in images]
        if len(set(dates)) != len(dates):
            raise serializers.ValidationError({"image_ids": "Cada escena debe tener una fecha distinta."})
        if len(ids) == 1:
            attrs["model"] = None
        elif attrs.get("model") and any(img.scl_factor is None for img in images):
            raise serializers.ValidationError({"model_id": "Todas las imágenes deben incluir SCL para el modelo."})
        attrs["_images"] = sorted(images, key=lambda img: img.acquisition_date)
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        images = validated_data.pop("_images")
        validated_data.pop("image_ids")
        analysis = Analysis.objects.create(owner=self.context["request"].user, **validated_data)
        AnalysisImage.objects.bulk_create([
            AnalysisImage(analysis=analysis, image=image, order=order)
            for order, image in enumerate(images)
        ])
        return analysis
