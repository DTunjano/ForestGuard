import re
from contextlib import ExitStack
from pathlib import Path

import numpy as np
import rasterio
from django.conf import settings
from rasterio.io import MemoryFile
from rasterio.windows import Window
from rest_framework import serializers

from .models import PipelineModel, SatelliteImage, StudyArea

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
    """Apply the normalizer's pixel mask in bounded windows before saving an upload."""
    band_numbers = {name: index for index, name in enumerate(descriptions, 1) if name}
    for row in range(0, src.height, 512):
        for col in range(0, src.width, 512):
            window = Window(col, row, min(512, src.width - col), min(512, src.height - row))
            if _window_has_valid_pixel(src, band_numbers, window, reflectance_scale, scl_factor):
                return True
    return False


def _window_has_valid_pixel(src, band_numbers, window, reflectance_scale, scl_factor):
    raw = src.read([band_numbers[name] for name in SPECTRAL_BANDS], window=window,
                   masked=True, out_dtype="float32")
    cube = raw.filled(np.nan)
    if reflectance_scale == "divide_10000":
        cube /= 10000.0
    valid = np.all(~np.ma.getmaskarray(raw), axis=0)
    valid &= np.all(np.isfinite(cube) & (cube >= 0) & (cube <= 1), axis=0)
    if "SCL" in band_numbers:
        scl_raw = src.read(band_numbers["SCL"], window=window, masked=True, out_dtype="float32")
        scl_values = scl_raw.filled(np.nan) * scl_factor
        rounded = np.rint(np.nan_to_num(scl_values, nan=0)).astype(np.int16)
        valid_scl = (~np.ma.getmaskarray(scl_raw)) & np.isfinite(scl_values)
        valid_scl &= np.abs(scl_values - rounded) <= 0.05
        valid &= valid_scl & np.isin(rounded, (4, 5))
    return bool(np.any(valid))


class StudyAreaSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudyArea
        fields = ("id", "name", "department", "municipality", "description", "created_at")
        read_only_fields = ("id", "created_at")


class SatelliteImageSerializer(serializers.ModelSerializer):
    file = serializers.FileField(
        write_only=True, help_text="GeoTIFF multibanda .tif o .tiff georreferenciado (B2, B3, B4, B5, B8, B11, B12; SCL opcional).",
    )

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
                self._raster_metadata = {
                    "band_descriptions": descriptions, "crs": str(src.crs),
                    "width": src.width, "height": src.height,
                }
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
        value = attrs["file"]
        try:
            with ExitStack() as stack:
                if hasattr(value, "temporary_file_path"):
                    src = stack.enter_context(rasterio.open(value.temporary_file_path()))
                else:
                    memory_file = stack.enter_context(MemoryFile(value.read()))
                    src = stack.enter_context(memory_file.open())
                if not contains_valid_pixel(src, descriptions, attrs["reflectance_scale"], attrs.get("scl_factor")):
                    raise serializers.ValidationError({
                        "file": "No hay píxeles válidos tras aplicar la escala de reflectancia y la máscara SCL declaradas."
                    })
        except rasterio.errors.RasterioError as exc:
            raise serializers.ValidationError({"file": "El GeoTIFF no se pudo leer completamente."}) from exc
        finally:
            value.seek(0)
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
