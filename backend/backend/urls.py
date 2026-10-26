from django.contrib import admin
from django.db import DatabaseError, connection
from django.http import HttpResponse, JsonResponse
from django.urls import include, path
from django.views.generic import RedirectView
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter

from accounts.views import (
    AdministratorCreateView,
    PermissionCatalogView,
    RoleViewSet,
    UserAdminViewSet,
)
from catalog.views import AdminPipelineModelViewSet


def health(_request):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except DatabaseError:
        return JsonResponse({"status": "unavailable"}, status=503)
    return JsonResponse({"status": "ok"})


def favicon(_request):
    return HttpResponse(status=204)


admin_router = DefaultRouter()
admin_router.register("users", UserAdminViewSet, basename="admin-user")
admin_router.register("roles", RoleViewSet, basename="admin-role")
admin_router.register("models", AdminPipelineModelViewSet, basename="admin-model")

urlpatterns = [
    path("", RedirectView.as_view(pattern_name="swagger-ui", permanent=False)),
    path("favicon.ico", favicon),
    path("health/", health),
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    path("api/v1/auth/", include("accounts.urls")),
    path("api/v1/", include("catalog.urls")),
    path("api/v1/", include("analyses.urls")),
    path("api/v1/admin/", include(admin_router.urls)),
    path("api/v1/admin/permissions/", PermissionCatalogView.as_view(), name="admin-permissions"),
    path("api/v1/admin/administrators/", AdministratorCreateView.as_view(), name="admin-administrator-create"),
]
