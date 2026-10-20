from django.db import transaction
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from catalog.models import PipelineModel, SatelliteImage

from .models import Analysis, AnalysisImage, ResultArtifact


class ResultArtifactSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResultArtifact
        fields = ("id", "kind", "relative_path", "size_bytes", "created_at")


class AnalysisSerializer(serializers.ModelSerializer):
    image_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1), write_only=True,
        help_text="Entre 1 y 32 identificadores de imágenes del área, sin fechas repetidas. Se procesan en orden cronológico.",
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

    def validate_study_area(self, value):
        if value.owner_id != self.context["request"].user.pk:
            raise serializers.ValidationError("Área de estudio no disponible.")
        return value

    def validate(self, attrs):
        ids = attrs["image_ids"]
        if not 1 <= len(ids) <= 32 or len(set(ids)) != len(ids):
            raise serializers.ValidationError({"image_ids": "Seleccione de 1 a 32 imágenes distintas."})
        images = list(SatelliteImage.objects.filter(pk__in=ids, owner=self.context["request"].user))
        if len(images) != len(ids) or any(img.study_area_id != attrs["study_area"].pk for img in images):
            raise serializers.ValidationError({"image_ids": "Imagen no disponible en el área seleccionada."})
        dates = [img.acquisition_date for img in images]
        if len(set(dates)) != len(dates):
            raise serializers.ValidationError({"image_ids": "Cada escena debe tener una fecha distinta."})
        if attrs.get("model") and len(ids) < 2:
            raise serializers.ValidationError({"model_id": "El modelo requiere al menos dos fechas."})
        if attrs.get("model") and any(img.scl_factor is None for img in images):
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
