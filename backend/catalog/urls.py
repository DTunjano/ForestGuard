from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import PipelineModelViewSet, SatelliteImageViewSet, StudyAreaViewSet

router = DefaultRouter()
router.register("study-areas", StudyAreaViewSet, basename="study-area")
router.register("images", SatelliteImageViewSet, basename="image")
router.register("models", PipelineModelViewSet, basename="pipeline-model")

urlpatterns = [path("", include(router.urls))]
