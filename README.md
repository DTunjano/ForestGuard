# ForestGuard backend

API Django para registrar escenas Sentinel-2 y ejecutar el pipeline histórico v7. La interfaz React vive en `frontend/` y no forma parte de los cambios del backend. El sistema **no predice riesgo futuro**. La clase ML expresa un patrón exploratorio de cambio entre fechas; los indicios de degradación son reglas espectrales y requieren revisión.

## Requisitos

- Python 3.13 y Docker Desktop con Docker Compose. Docker ejecuta solo PostgreSQL.
- Espacio local para las escenas cargadas, resultados y el modelo v9.
- Un archivo `.env` creado a partir de `.env.example`, con `POSTGRES_PASSWORD` y `DJANGO_SECRET_KEY` aleatorios y privados.

## Inicio local (PowerShell)

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
# Editar .env: definir POSTGRES_PASSWORD y DJANGO_SECRET_KEY privados.
docker compose up -d db
python -m venv backend/.venv
& backend/.venv/Scripts/python.exe -m pip install -r backend/requirements-dev.txt -r backend/requirements-report.txt
Set-Location backend
& ./.venv/Scripts/python.exe manage.py migrate
& ./.venv/Scripts/python.exe manage.py sync_pipeline_model
& ./.venv/Scripts/python.exe manage.py runserver 127.0.0.1:8000
```

Para crear una cuenta administradora por primera vez, ejecute antes de `runserver`:

```powershell
& ./.venv/Scripts/python.exe manage.py createsuperuser
```

En otra consola, desde `backend/`, inicia el procesador de análisis:

```powershell
& ./.venv/Scripts/python.exe manage.py run_analysis_worker
```

`py manage.py runserver` también funciona si el lanzador `py` está configurado y el entorno virtual está activado. En este equipo `py` no detecta Python; el ejecutable de `.venv` evita ese problema. Django carga automáticamente el `.env` de la raíz del repositorio sin sobrescribir variables ya definidas en el sistema. PostgreSQL solo escucha en `127.0.0.1` en el puerto `POSTGRES_PORT` (5432 por defecto); si está ocupado, use otro puerto, por ejemplo 5433, en `.env`. Las cargas y resultados quedan en `backend/media/`, ignorado por Git.

API: `http://localhost:8000/api/v1/`. Swagger: `http://localhost:8000/api/docs/`. Salud: `http://localhost:8000/health/` (`200` si PostgreSQL responde, `503` si no). El worker toma trabajos pendientes desde PostgreSQL; debe permanecer abierto en otra consola. Las migraciones son un paso explícito, no se ejecutan automáticamente en cada arranque.

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
Set-Location backend
& ./.venv/Scripts/python.exe manage.py check
& ./.venv/Scripts/python.exe manage.py makemigrations --check --dry-run
& ./.venv/Scripts/python.exe -m pytest -q --cov=accounts --cov=catalog --cov=analyses
& ./.venv/Scripts/python.exe -m ruff check accounts catalog analyses backend tests
& ./.venv/Scripts/python.exe manage.py spectacular --validate --fail-on-warn
```

Pytest usa una base temporal de PostgreSQL creada por Django; no modifica las tablas de desarrollo. Las pruebas del pipeline deben usar escenas sintéticas o recortes pequeños y una salida aislada.

`tests/test_real_raster.py` permite una comprobación adicional con GeoTIFF Sentinel-2 reales. Indique la ruta local de la primera escena con `FORESTGUARD_REAL_TEST_RASTER` y su fecha `AAAA-MM-DD` con `FORESTGUARD_REAL_TEST_DATE`; agregue `FORESTGUARD_REAL_TEST_RASTER_2` y `FORESTGUARD_REAL_TEST_DATE_2` para comprobar un intervalo. Si ambas escenas incluyen SCL, indique `FORESTGUARD_REAL_TEST_SCL_FACTOR` (`1` o `10000`) y `FORESTGUARD_REAL_TEST_USE_MODEL=1` para ejecutar v9. Ejecute `& ./.venv/Scripts/python.exe -m pytest -q tests/test_real_raster.py`. La prueba se omite cuando faltan las variables de la primera escena, usa una base temporal y guarda los resultados en un directorio temporal. Comprueba carga, normalización, ejecución y artefactos, pero una clasificación ejecutada no demuestra la calidad del modelo ML ni valida su transferencia geográfica.

## Variables de entorno

`POSTGRES_DB`, `POSTGRES_USER` y `POSTGRES_PASSWORD` configuran PostgreSQL; `POSTGRES_HOST=127.0.0.1` y `POSTGRES_PORT=5432` conectan el backend local con el puerto publicado por Docker. `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` y `DJANGO_SECURE_COOKIES` configuran el servidor; `MAX_UPLOAD_BYTES` fija el tamaño máximo por archivo. `MEDIA_ROOT` y `PIPELINE_ROOT` usan por defecto `backend/media` y `backend/pipeline`. En despliegues públicos se debe terminar TLS delante de la API y configurar dominios y cookies seguras; `runserver` es para desarrollo local.

## Arquitectura y modelo de datos

Ver [arquitectura](docs/arquitectura.md), [contrato de la API](docs/api.md), [guía de integración posterior con React](docs/integracion-react.md) y [contrato del pipeline](backend/pipeline/README.md). La base PostgreSQL guarda usuarios, áreas, metadatos de imágenes, trabajos y referencias a resultados. Los archivos raster se guardan en un volumen persistente fuera de PostgreSQL. El modelo v9 se distribuye dentro del backend como paquete confiable y se registra con `sync_pipeline_model`; no hay carga de modelos arbitrarios desde la API.

Si un trabajador se interrumpe y deja un análisis en `running`, revisar primero desde `backend/` con `& ./.venv/Scripts/python.exe manage.py fail_stale_analyses --older-than-hours 24 --dry-run`. Repetir sin `--dry-run` solo después de comprobar que el trabajador no sigue procesando ese análisis.
