import uuid
from pathlib import Path

from django.conf import settings
from django.core.validators import FileExtensionValidator
from django.db import models


def upload_path(_instance, filename):
    return f"uploads/{uuid.uuid4().hex}{Path(filename).suffix.lower()}"


class StudyArea(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="study_areas")
    name = models.CharField(max_length=160)
    department = models.CharField(max_length=100, blank=True)
    municipality = models.CharField(max_length=100, blank=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)


class SatelliteImage(models.Model):
    class ReflectanceScale(models.TextChoices):
        FRACTION = "fraction", "0 a 1"
        DIVIDE_10000 = "divide_10000", "Dividir entre 10000"

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="images")
    study_area = models.ForeignKey(StudyArea, on_delete=models.PROTECT, related_name="images")
    name = models.CharField(max_length=255)
    file = models.FileField(upload_to=upload_path, validators=[FileExtensionValidator(["tif", "tiff"])])
    acquisition_date = models.DateField()
    size_bytes = models.BigIntegerField()
    reflectance_scale = models.CharField(max_length=20, choices=ReflectanceScale.choices)
    scl_factor = models.PositiveSmallIntegerField(null=True, blank=True)
    band_descriptions = models.JSONField(default=list)
    crs = models.CharField(max_length=100)
    width = models.PositiveIntegerField()
    height = models.PositiveIntegerField()
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-uploaded_at",)
        indexes = [models.Index(fields=("owner", "acquisition_date"))]


class PipelineModel(models.Model):
    name = models.CharField(max_length=120)
    version = models.CharField(max_length=40, unique=True)
    algorithm = models.CharField(max_length=80)
    relative_path = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    performance_profile = models.JSONField(default=dict)
    active = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
