from pathlib import Path

import rasterio
from django.conf import settings
from rasterio.io import MemoryFile
from rest_framework import serializers

from .models import PipelineModel, SatelliteImage, StudyArea

REQUIRED_BANDS = {"B2", "B3", "B4", "B5", "B8", "B11", "B12"}


class StudyAreaSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudyArea
        fields = ("id", "name", "department", "municipality", "description", "created_at")
        read_only_fields = ("id", "created_at")


class SatelliteImageSerializer(serializers.ModelSerializer):
    file = serializers.FileField(write_only=True)

    class Meta:
        model = SatelliteImage
        fields = (
            "id", "study_area", "name", "file", "acquisition_date", "size_bytes",
            "reflectance_scale", "scl_factor", "band_descriptions", "crs", "width", "height", "uploaded_at",
        )
        read_only_fields = ("id", "size_bytes", "band_descriptions", "crs", "width", "height", "uploaded_at")

    def validate_study_area(self, value):
        if value.owner_id != self.context["request"].user.id:
            raise serializers.ValidationError("Área de estudio no disponible.")
        return value

    def validate_file(self, value):
        if Path(value.name).suffix.lower() not in {".tif", ".tiff"}:
            raise serializers.ValidationError("Se requiere un GeoTIFF .tif o .tiff.")
        if value.size > settings.MAX_UPLOAD_BYTES:
            raise serializers.ValidationError("El archivo supera el tamaño permitido.")
        try:
            if hasattr(value, "temporary_file_path"):
                raster = rasterio.open(value.temporary_file_path())
                memory_file = None
            else:
                memory_file = MemoryFile(value.read())
                raster = memory_file.open()
            with raster as src:
                descriptions = [str(item).upper() if item else "" for item in src.descriptions]
                if not REQUIRED_BANDS.issubset(descriptions):
                    raise serializers.ValidationError("Faltan bandas Sentinel-2 requeridas por el pipeline.")
                if src.crs is None:
                    raise serializers.ValidationError("El GeoTIFF debe estar georreferenciado.")
                self._raster_metadata = {
                    "band_descriptions": descriptions, "crs": str(src.crs),
                    "width": src.width, "height": src.height,
                }
            if memory_file is not None:
                memory_file.close()
        except rasterio.errors.RasterioError as exc:
            raise serializers.ValidationError("El archivo no es un GeoTIFF legible.") from exc
        value.seek(0)
        return value

    def validate(self, attrs):
        descriptions = self._raster_metadata["band_descriptions"]
        if "SCL" in descriptions and attrs.get("scl_factor") not in (1, 10000):
            raise serializers.ValidationError({"scl_factor": "Declare 1 o 10000 para SCL."})
        if "SCL" not in descriptions and attrs.get("scl_factor") is not None:
            raise serializers.ValidationError({"scl_factor": "La imagen no contiene SCL."})
        return attrs

    def create(self, validated_data):
        file = validated_data["file"]
        return SatelliteImage.objects.create(
            owner=self.context["request"].user, size_bytes=file.size,
            **self._raster_metadata, **validated_data,
        )


class PipelineModelSerializer(serializers.ModelSerializer):
    class Meta:
        model = PipelineModel
        fields = ("id", "name", "version", "algorithm", "description", "performance_profile", "active")
