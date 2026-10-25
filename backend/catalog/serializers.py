import re
from contextlib import ExitStack
from pathlib import Path

import rasterio
from django.conf import settings
from rasterio.io import MemoryFile
from rest_framework import serializers

from pipeline.src.raster_quality import require_coverage, scan_coverage, valid_mask, windows

from .models import PipelineModel, SatelliteImage, StudyArea
from .raster_detection import acquisition_date, raster_scales

REQUIRED_BANDS = {"B2", "B3", "B4", "B5", "B8", "B11", "B12"}
SPECTRAL_BANDS = ("B2", "B3", "B4", "B5", "B8", "B11", "B12")


def canonical_band(description):
    text = str(description or "").strip().upper()
    match = re.match(r"^(B0?[2-5]|B0?8|B11|B12)(?=$|\W)", text)
    if match:
        return "B" + str(int(match.group(1)[1:]))
    if re.match(r"^SCL(?=$|\W)", text):
        return "SCL"
    return ""


def contains_valid_pixel(src, descriptions, reflectance_scale, scl_factor):
    """Compatibility helper using the same quality mask as uploads and analysis."""
    mapping = {name: index for index, name in enumerate(descriptions, 1) if name}
    return any(valid_mask(src, mapping, window, reflectance_scale, scl_factor).any()
               for window in windows(src))


class StudyAreaSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudyArea
        fields = ("id", "name", "department", "municipality", "description", "created_at")
        read_only_fields = ("id", "created_at")


class SatelliteImageSerializer(serializers.ModelSerializer):
    valid_coverage_percent = serializers.SerializerMethodField(help_text="Porcentaje exacto de píxeles utilizables; mínimo requerido: 60 %. Null en cargas antiguas aún no verificadas.")

    def get_valid_coverage_percent(self, obj) -> float | None:
        return obj.valid_pixel_count / (obj.width * obj.height) * 100 if obj.valid_pixel_count is not None else None
    name = serializers.CharField(required=False, allow_blank=True, help_text="Nombre opcional; si se omite, se usa el nombre del archivo.")
    file = serializers.FileField(
        write_only=True, help_text="GeoTIFF multibanda .tif o .tiff georreferenciado (B2, B3, B4, B5, B8, B11, B12; SCL opcional).",
    )

    class Meta:
        model = SatelliteImage
        fields = (
            "id", "study_area", "name", "file", "acquisition_date", "size_bytes",
            "reflectance_scale", "scl_factor", "band_descriptions", "crs", "width", "height", "uploaded_at",
            "valid_pixel_count", "valid_coverage_percent", "quality_check_version",
        )
        read_only_fields = (
            "id", "acquisition_date", "reflectance_scale", "scl_factor", "size_bytes",
            "band_descriptions", "crs", "width", "height", "uploaded_at", "valid_pixel_count", "quality_check_version",
        )

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
            with ExitStack() as stack:
                if hasattr(value, "temporary_file_path"):
                    src = stack.enter_context(rasterio.open(value.temporary_file_path()))
                else:
                    memory_file = stack.enter_context(MemoryFile(value.read()))
                    src = stack.enter_context(memory_file.open())
                if src.driver != "GTiff" or src.crs is None or src.width <= 0 or src.height <= 0:
                    raise serializers.ValidationError("Se requiere un GeoTIFF georreferenciado válido.")
                if any(scale != 1 for scale in src.scales) or any(offset != 0 for offset in src.offsets):
                    raise serializers.ValidationError("El raster declara escala u offset por banda.")
                descriptions = [canonical_band(item) for item in src.descriptions]
                if not REQUIRED_BANDS.issubset(descriptions):
                    raise serializers.ValidationError("Faltan bandas Sentinel-2 requeridas por el pipeline.")
                named = [item for item in descriptions if item]
                if len(named) != len(set(named)):
                    raise serializers.ValidationError("El GeoTIFF contiene bandas Sentinel-2 duplicadas.")
                detected_date = acquisition_date(value.name, src)
                detected_scale, detected_scl = raster_scales(src, descriptions)
                self._raster_metadata = {
                    "band_descriptions": descriptions, "crs": str(src.crs),
                    "width": src.width, "height": src.height,
                    "acquisition_date": detected_date,
                    "reflectance_scale": detected_scale, "scl_factor": detected_scl,
                }
        except rasterio.errors.RasterioError as exc:
            raise serializers.ValidationError("El archivo no es un GeoTIFF legible.") from exc
        value.seek(0)
        return value

    def validate(self, attrs):
        descriptions = self._raster_metadata["band_descriptions"]
        value = attrs["file"]
        try:
            with ExitStack() as stack:
                if hasattr(value, "temporary_file_path"):
                    src = stack.enter_context(rasterio.open(value.temporary_file_path()))
                else:
                    memory_file = stack.enter_context(MemoryFile(value.read()))
                    src = stack.enter_context(memory_file.open())
                quality = scan_coverage(src, descriptions, self._raster_metadata["reflectance_scale"], self._raster_metadata["scl_factor"])
                try:
                    require_coverage(quality)
                except ValueError as exc:
                    raise serializers.ValidationError({"file": str(exc)}) from exc
                self._raster_metadata.update(valid_pixel_count=quality["valid_pixels"], quality_check_version=quality["version"])
        except rasterio.errors.RasterioError as exc:
            raise serializers.ValidationError({"file": "El GeoTIFF no se pudo leer completamente."}) from exc
        finally:
            value.seek(0)
        if not attrs.get("name", "").strip():
            attrs["name"] = Path(value.name).stem[:255]
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
