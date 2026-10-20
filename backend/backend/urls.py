from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter

from accounts.views import UserAdminViewSet


def health(_request):
    return JsonResponse({"status": "ok"})


admin_router = DefaultRouter()
admin_router.register("users", UserAdminViewSet, basename="admin-user")

urlpatterns = [
    path("health/", health),
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    path("api/v1/auth/", include("accounts.urls")),
    path("api/v1/", include("catalog.urls")),
    path("api/v1/", include("analyses.urls")),
    path("api/v1/admin/", include(admin_router.urls)),
]
