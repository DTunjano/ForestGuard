"""ForestGuard settings shared by the API and processing worker."""

import os
from datetime import timedelta
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR.parent / ".env", override=False)


def env_bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).lower() in {"1", "true", "yes", "on"}


DEBUG = env_bool("DJANGO_DEBUG")
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = "development-only-replace-before-deployment"
    else:
        raise ImproperlyConfigured("DJANGO_SECRET_KEY is required when DEBUG is false")

ALLOWED_HOSTS = [host.strip() for host in os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if host.strip()]
CSRF_TRUSTED_ORIGINS = [origin.strip() for origin in os.getenv("CSRF_TRUSTED_ORIGINS", "").split(",") if origin.strip()]
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",") if origin.strip()]

INSTALLED_APPS = [
    "django.contrib.admin", "django.contrib.auth", "django.contrib.contenttypes",
    "django.contrib.sessions", "django.contrib.messages", "django.contrib.staticfiles",
    "rest_framework", "rest_framework_simplejwt.token_blacklist", "drf_spectacular",
    "corsheaders", "accounts", "catalog", "analyses",
]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware", "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware", "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware", "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware", "django.middleware.clickjacking.XFrameOptionsMiddleware",
]
ROOT_URLCONF = "backend.urls"
TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates", "DIRS": [], "APP_DIRS": True,
    "OPTIONS": {"context_processors": [
        "django.template.context_processors.debug", "django.template.context_processors.request",
        "django.contrib.auth.context_processors.auth", "django.contrib.messages.context_processors.messages",
    ]},
}]
WSGI_APPLICATION = "backend.wsgi.application"
ASGI_APPLICATION = "backend.asgi.application"
DATABASES = {"default": {
    "ENGINE": "django.db.backends.postgresql", "NAME": os.getenv("POSTGRES_DB", "forestguard"),
    "USER": os.getenv("POSTGRES_USER", "forestguard"), "PASSWORD": os.getenv("POSTGRES_PASSWORD", ""),
    "HOST": os.getenv("POSTGRES_HOST", "127.0.0.1"), "PORT": os.getenv("POSTGRES_PORT", "5432"),
    "CONN_MAX_AGE": 60,
}}
AUTH_USER_MODEL = "accounts.User"
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ("rest_framework_simplejwt.authentication.JWTAuthentication",),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated", "accounts.rbac.ProjectPermission"),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination", "PAGE_SIZE": 20,
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.AnonRateThrottle", "rest_framework.throttling.UserRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {"anon": "30/min", "user": "120/min", "auth": "10/min"},
}
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15), "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True, "BLACKLIST_AFTER_ROTATION": True,
    "CHECK_REVOKE_TOKEN": True,
}
SPECTACULAR_SETTINGS = {
    "TITLE": "ForestGuard API",
    "DESCRIPTION": (
        "API para cargar escenas Sentinel-2, ejecutar análisis históricos y consultar sus resultados. "
        "Los análisis se procesan en segundo plano mediante el worker local. "
        "No estima riesgo futuro.\n\n"
        "**Inicio rápido:** registre una cuenta en Autenticación, obtenga un token en "
        "`POST /api/v1/auth/token/` y use **Authorize** con el access token. "
        "Luego cree un área, cargue un GeoTIFF y solicite un análisis. "
        "Los recursos y resultados son privados para su propietario. "
        "Los IDs son generados por el servidor; consulte los listados para elegir imágenes u otros recursos. "
        "Swagger UI no copia automáticamente un ID de una respuesta a otra operación."
    ),
    "VERSION": "1.0.0", "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "TAGS": [
        {"name": "Autenticación", "description": "Registro, JWT, sesión y contraseña."},
        {"name": "Mi cuenta", "description": "Perfil del usuario autenticado."},
        {"name": "Administración de usuarios", "description": "Cuentas, creación de administradores y asignación de roles. Solo un superusuario puede crear otro superusuario."},
        {"name": "Roles y permisos", "description": "Roles múltiples y permisos por módulo. Roles base protegidos."},
        {"name": "Áreas de estudio", "description": "Áreas privadas que agrupan imágenes y análisis."},
        {"name": "Imágenes satelitales", "description": "Carga y consulta de GeoTIFF Sentinel-2."},
        {"name": "Modelos", "description": "Catálogo activo y administración de paquetes confiables instalados; registro, edición, disponibilidad y eliminación protegida."},
        {"name": "Análisis", "description": "Creación, estado y eliminación de análisis históricos."},
        {"name": "Resultados", "description": "Descarga y visualización privada de artefactos."},
    ],
    "SWAGGER_UI_SETTINGS": {"docExpansion": "none", "filter": True, "displayRequestDuration": True},
}
LANGUAGE_CODE = "es-co"
TIME_ZONE = "America/Bogota"
USE_I18N = True
USE_TZ = True
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_ROOT = Path(os.getenv("MEDIA_ROOT", str(BASE_DIR / "media")))
MEDIA_URL = "media/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 2 * 1024 * 1024
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(1024 * 1024 * 1024)))
ANALYSIS_HEARTBEAT_SECONDS = 30
ANALYSIS_STALE_MINUTES = 15
PIPELINE_ROOT = Path(os.getenv("PIPELINE_ROOT", str(BASE_DIR / "pipeline")))
SECURE_CONTENT_TYPE_NOSNIFF = True
SESSION_COOKIE_SECURE = env_bool("DJANGO_SECURE_COOKIES")
CSRF_COOKIE_SECURE = env_bool("DJANGO_SECURE_COOKIES")
