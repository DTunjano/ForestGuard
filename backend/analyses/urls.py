from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AnalysisViewSet, ArtifactPreviewView

router = DefaultRouter()
router.register("analyses", AnalysisViewSet, basename="analysis")
urlpatterns = [
    path("artifacts/<int:artifact_id>/preview/", ArtifactPreviewView.as_view(), name="artifact-preview"),
    path("", include(router.urls)),
]
