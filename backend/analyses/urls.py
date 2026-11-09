from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .evaluation_views import V9EvaluationView
from .views import (
    AnalysisExportView,
    AnalysisResultsView,
    AnalysisViewSet,
    ArtifactCategoryMaskView,
    ArtifactDownloadView,
    ArtifactMetadataView,
    ArtifactPreviewView,
)

router = DefaultRouter()
router.register("analyses", AnalysisViewSet, basename="analysis")
urlpatterns = [
    path("analyses/<int:analysis_id>/results/", AnalysisResultsView.as_view(), name="analysis-results"),
    path("analyses/<int:analysis_id>/export/", AnalysisExportView.as_view(), name="analysis-export"),
    path("artifacts/<int:artifact_id>/preview/", ArtifactPreviewView.as_view(), name="artifact-preview"),
    path("artifacts/<int:artifact_id>/download/", ArtifactDownloadView.as_view(), name="artifact-download"),
    path("artifacts/<int:artifact_id>/metadata/", ArtifactMetadataView.as_view(), name="artifact-metadata"),
    path("artifacts/<int:artifact_id>/category-mask/", ArtifactCategoryMaskView.as_view(), name="artifact-category-mask"),
    path("artifacts/<int:artifact_id>/v9-evaluation/", V9EvaluationView.as_view(), name="v9-evaluation"),
    path("", include(router.urls)),
]
