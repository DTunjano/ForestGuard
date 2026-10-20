# ForestGuard backend

API Django para registrar escenas Sentinel-2 y ejecutar el pipeline histórico v7. La interfaz React vive en `frontend/` y no forma parte de los cambios del backend. El sistema **no predice riesgo futuro**. La clase ML expresa un patrón exploratorio de cambio entre fechas; los indicios de degradación son reglas espectrales y requieren revisión.

## Requisitos

- Docker Desktop con Docker Compose.
- Espacio para las escenas cargadas, resultados y el modelo v9.
- Un archivo `.env` creado a partir de `.env.example`, con `POSTGRES_PASSWORD` y `DJANGO_SECRET_KEY` aleatorios y privados.

La imagen instala `requirements.txt` y `requirements-report.txt`; este último añade la generación de PDF.

## Inicio local

```powershell
Copy-Item .env.example .env
# Editar .env antes de continuar.
docker compose build
docker compose up -d db
docker compose run --rm api python manage.py migrate
docker compose run --rm api python manage.py sync_pipeline_model
docker compose run --rm api python manage.py createsuperuser
docker compose up -d api worker
```

API: `http://localhost:8000/api/v1/`. Swagger: `http://localhost:8000/api/docs/`. Salud: `http://localhost:8000/health/` (`200` si PostgreSQL responde, `503` si no). El puerto 8000 se publica solo en la interfaz local por defecto. El servicio `worker` toma trabajos pendientes desde PostgreSQL. Las migraciones son un paso explícito, no se ejecutan automáticamente en cada arranque.

## Flujo de análisis

1. Registrar usuario en `POST /api/v1/auth/register/`; obtener JWT con `POST /api/v1/auth/token/` y renovar con `POST /api/v1/auth/token/refresh/`.
2. Crear área en `POST /api/v1/study-areas/`.
3. Cargar cada GeoTIFF multibanda en `POST /api/v1/images/` con `multipart/form-data`: `study_area`, `name`, `acquisition_date` (`AAAA-MM-DD`), `reflectance_scale` (`fraction` o `divide_10000`), `scl_factor` (`1` o `10000` si hay SCL), `file`.
4. Crear análisis con `POST /api/v1/analyses/`: `name`, `study_area`, `image_ids` y `model_id` opcional. Con una imagen se obtienen índices; con varias fechas hay diferencias e indicios de degradación. El modelo v9 requiere al menos dos escenas con SCL y solo se ejecuta en intervalos que cumplen su contrato.
5. Consultar estado y resumen en `GET /api/v1/analyses/{id}/`. Descargar un GeoTIFF, JSON o reporte PDF mediante `GET /api/v1/analyses/{id}/artifacts/{artifact_id}/download/`. Los mapas raster tienen metadatos y miniatura PNG privada en `/metadata/` y `/preview/` sobre la misma ruta del artefacto.

Todos los recursos del usuario se filtran por propietario. Los resultados no se publican como archivos estáticos. El cierre de sesión se realiza con `POST /api/v1/auth/logout/` y el refresh token. El cliente debe descartar su access token; el refresh token queda invalidado.

El usuario puede cambiar su contraseña con `POST /api/v1/auth/password/change/`; se invalidan los tokens anteriores. Un administrador puede listar, crear y editar cuentas en `/api/v1/admin/users/`, incluida su activación y rol. Las cuentas se desactivan sin borrar sus análisis.

Un análisis terminado puede eliminarse con `DELETE /api/v1/analyses/{id}/`; esto elimina su registro y sus resultados. Los análisis en cola o en ejecución no se eliminan para evitar carreras con el worker.

## Entrada aceptada

La primera versión de la API recibe un **GeoTIFF de una sola grilla** con descripciones inequívocas `B2, B3, B4, B5, B8, B11, B12` y opcionalmente `SCL`. La escala de reflectancia y el factor SCL deben declararse. El worker normaliza el archivo sin alterar el original. Sin SCL se permiten índices descriptivos, pero no la clasificación ML. SAFE L2A y COG por banda existen en el paquete v7, pero todavía no tienen endpoint de carga; sus metadatos y estructura necesitan una interfaz propia.

## Desarrollo y pruebas

```powershell
docker compose run --rm api python manage.py check
docker compose run --rm api python manage.py makemigrations --check --dry-run
docker compose run --rm api pytest -q --cov=accounts --cov=catalog --cov=analyses
docker compose run --rm api ruff check accounts catalog analyses backend tests
docker compose run --rm api python manage.py spectacular --validate --fail-on-warn
```

Pytest usa una base temporal de PostgreSQL creada por Django; no modifica las tablas de desarrollo. Las pruebas del pipeline deben usar escenas sintéticas o recortes pequeños y una salida aislada.

`tests/test_real_raster.py` permite una comprobación adicional con un GeoTIFF Sentinel-2 real de siete bandas. Monte la carpeta de la escena como `/real:ro` en `docker compose run`, indique su ruta dentro del contenedor con `FORESTGUARD_REAL_TEST_RASTER` y la fecha `AAAA-MM-DD` con `FORESTGUARD_REAL_TEST_DATE`, y ejecute `pytest -q tests/test_real_raster.py`. La prueba se omite cuando faltan esas variables, usa una base temporal y guarda los resultados en un directorio temporal. Comprueba carga, normalización, ejecución y artefactos de una escena; no demuestra la calidad del modelo ML para pares de fechas.

## Variables de entorno

`POSTGRES_DB`, `POSTGRES_USER` y `POSTGRES_PASSWORD` configuran PostgreSQL; `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` y `DJANGO_SECURE_COOKIES` configuran el servidor; `MAX_UPLOAD_BYTES` fija el tamaño máximo por archivo. `POSTGRES_HOST`, `MEDIA_ROOT` y `PIPELINE_ROOT` tienen valores definidos por Compose. En despliegues públicos se debe terminar TLS delante de la API y configurar dominios y cookies seguras.

## Arquitectura y modelo de datos

Ver [arquitectura](docs/arquitectura.md), [contrato de la API](docs/api.md) y [contrato del pipeline](backend/pipeline/README.md). La base PostgreSQL guarda usuarios, áreas, metadatos de imágenes, trabajos y referencias a resultados. Los archivos raster se guardan en un volumen persistente fuera de PostgreSQL. El modelo v9 se distribuye dentro del backend como paquete confiable y se registra con `sync_pipeline_model`; no hay carga de modelos arbitrarios desde la API.

Si un trabajador se interrumpe y deja un análisis en `running`, revisar primero con `docker compose run --rm api python manage.py fail_stale_analyses --older-than-hours 24 --dry-run`. Repetir sin `--dry-run` solo después de comprobar que el trabajador no sigue procesando ese análisis.
