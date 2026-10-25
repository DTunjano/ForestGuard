"""Upload and legacy-image checks, before creating a job or normalizing rasters."""

import rasterio

from pipeline.src.raster_quality import QUALITY_VERSION, require_coverage, scan_coverage


def check_image_quality(image, *, refresh=False):
    if (
        not refresh
        and image.quality_check_version == QUALITY_VERSION
        and image.valid_pixel_count is not None
    ):
        quality = {
            "valid_pixels": image.valid_pixel_count,
            "total_pixels": image.width * image.height,
            "valid_fraction": image.valid_pixel_count / (image.width * image.height),
        }
    else:
        with rasterio.open(image.file.path) as source:
            quality = scan_coverage(
                source, image.band_descriptions, image.reflectance_scale, image.scl_factor
            )
        type(image).objects.filter(pk=image.pk).update(
            valid_pixel_count=quality["valid_pixels"], quality_check_version=QUALITY_VERSION
        )
    require_coverage(quality, image.name)
    return quality
