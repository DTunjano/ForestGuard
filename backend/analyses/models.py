from django.conf import settings
from django.db import models

from catalog.models import PipelineModel, SatelliteImage, StudyArea


class Analysis(models.Model):
    class Status(models.TextChoices):
        QUEUED = "queued", "En cola"
        RUNNING = "running", "Procesando"
        COMPLETED = "completed", "Completado"
        FAILED = "failed", "Fallido"

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="analyses")
    study_area = models.ForeignKey(StudyArea, on_delete=models.PROTECT, related_name="analyses")
    model = models.ForeignKey(PipelineModel, on_delete=models.PROTECT, null=True, blank=True)
    name = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.QUEUED)
    error_message = models.TextField(blank=True)
    summary = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [models.Index(fields=("status", "created_at"))]


class AnalysisImage(models.Model):
    analysis = models.ForeignKey(Analysis, on_delete=models.CASCADE, related_name="scene_links")
    image = models.ForeignKey(SatelliteImage, on_delete=models.PROTECT)
    order = models.PositiveSmallIntegerField()

    class Meta:
        ordering = ("order",)
        constraints = [
            models.UniqueConstraint(fields=("analysis", "image"), name="unique_analysis_image"),
            models.UniqueConstraint(fields=("analysis", "order"), name="unique_analysis_order"),
        ]


class ResultArtifact(models.Model):
    analysis = models.ForeignKey(Analysis, on_delete=models.CASCADE, related_name="artifacts")
    relative_path = models.CharField(max_length=500)
    kind = models.CharField(max_length=40)
    size_bytes = models.BigIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("analysis", "relative_path"), name="unique_artifact_path")]
