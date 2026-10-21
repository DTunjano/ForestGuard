from django.db import transaction
from django.urls import reverse
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from catalog.models import PipelineModel, SatelliteImage

from .models import Analysis, AnalysisImage, ResultArtifact


class ResultArtifactSerializer(serializers.ModelSerializer):
    preview_url = serializers.SerializerMethodField(help_text="Ruta privada de la vista PNG; solo para raster.")
    download_url = serializers.SerializerMethodField(help_text="Ruta privada de descarga del archivo.")
    metadata_url = serializers.SerializerMethodField(help_text="Ruta privada de metadatos; solo para raster.")

    class Meta:
        model = ResultArtifact
        fields = ("id", "kind", "relative_path", "size_bytes", "preview_url", "download_url",
                  "metadata_url", "created_at")

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
        read_only=True, help_text="El servidor la deduce de las imágenes seleccionadas.",
    )
    image_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1), write_only=True,
        help_text="Elige de 1 a 32 IDs de GET /api/v1/images/. Una sola imagen produce índices; varias permiten comparar fechas.",
    )
    model_id = serializers.PrimaryKeyRelatedField(
        source="model", queryset=PipelineModel.objects.filter(active=True), required=False, allow_null=True,
        help_text="Opcional: modelo activo. Requiere al menos dos escenas con SCL y un intervalo compatible.",
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

    def validate(self, attrs):
        ids = attrs["image_ids"]
        if not 1 <= len(ids) <= 32 or len(set(ids)) != len(ids):
            raise serializers.ValidationError({"image_ids": "Seleccione de 1 a 32 imágenes distintas."})
        images = list(SatelliteImage.objects.filter(pk__in=ids, owner=self.context["request"].user))
        if len(images) != len(ids):
            raise serializers.ValidationError({"image_ids": "Una o más imágenes no están disponibles."})
        if len({img.study_area_id for img in images}) != 1:
            raise serializers.ValidationError({"image_ids": "Todas las imágenes deben pertenecer a la misma área."})
        legacy_area = self.initial_data.get("study_area")
        if legacy_area is not None and str(legacy_area) != str(images[0].study_area_id):
            raise serializers.ValidationError({"study_area": "No coincide con el área de las imágenes."})
        dates = [img.acquisition_date for img in images]
        if len(set(dates)) != len(dates):
            raise serializers.ValidationError({"image_ids": "Cada escena debe tener una fecha distinta."})
        if attrs.get("model") and len(ids) < 2:
            raise serializers.ValidationError({"model_id": "El modelo requiere al menos dos fechas."})
        if attrs.get("model") and any(img.scl_factor is None for img in images):
            raise serializers.ValidationError({"model_id": "Todas las imágenes deben incluir SCL para el modelo."})
        attrs["study_area"] = images[0].study_area
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
