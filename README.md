# ForestGuard

Actualización: [calidad de entrada y comparaciones](docs/calidad-y-comparaciones.md).
Se requiere cobertura válida ≥ 60 % y las comparaciones admiten desde 35 días,
sin límite máximo. El PDF conserva resultados e interpretación sin la sección
de método y trazabilidad.

API Django y frontend React para registrar escenas Sentinel-2 y ejecutar el pipeline histórico v7. La integración local permite cargar imágenes, crear análisis y consultar/descargar resultados desde `frontend/`. El sistema **no predice riesgo futuro**. La clase ML expresa un patrón exploratorio de cambio entre fechas; los indicios espectrales requieren revisión.

La [guía de integración local](docs/integracion-local.md) incluye arquitectura, sesión, ramas, pruebas y comandos de las tres consolas. El frontend continúa iniciándose con `pnpm dev`.

La [guía de cobertura y roles](docs/cobertura-y-roles.md) describe los mapas de original/resultado, categorías y porcentajes, PDF y gestión de roles con permisos. Tras actualizar esta fase, ejecute `py manage.py migrate` y reinicie el worker. Los análisis nuevos incorporan el método `forestguard_spectral_rules_v1`; los anteriores conservan su versión.

## Requisitos

- Python 3.13 y Docker Desktop con Docker Compose. Docker ejecuta solo PostgreSQL.
- Espacio local para las escenas cargadas, resultados y el modelo v9.
- Un archivo `.env` creado a partir de `.env.example`, con `POSTGRES_PASSWORD` y `DJANGO_SECRET_KEY` aleatorios y privados.

## Inicio local (PowerShell)

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
# Editar .env: definir POSTGRES_PASSWORD y DJANGO_SECRET_KEY privados.
docker compose up -d --wait db
py -3.13 -m venv backend/.venv
& backend/.venv/Scripts/Activate.ps1
py -m pip install -r backend/requirements-dev.txt -r backend/requirements-report.txt
Set-Location backend
py manage.py migrate
py manage.py sync_pipeline_model
py manage.py runserver 127.0.0.1:8000
```

Para crear una cuenta administradora por primera vez, ejecute antes de `runserver`:

```powershell
py manage.py createsuperuser
```

En otra consola, desde `backend/`, inicia el procesador de análisis:

```powershell
& ./.venv/Scripts/Activate.ps1
py manage.py run_analysis_worker
```

Active `.venv` en **cada consola** antes de ejecutar `py manage.py`; así `py` usa las dependencias del proyecto. Compruebe el lanzador con `py --version` y el entorno activo con `py -c "import sys; print(sys.executable)"`: debe mostrar `backend/.venv/Scripts/python.exe`. Si la activación de PowerShell está restringida en otro equipo, puede ejecutar directamente `& ./.venv/Scripts/python.exe manage.py runserver`. Django carga automáticamente el `.env` de la raíz del repositorio sin sobrescribir variables ya definidas en el sistema. PostgreSQL solo escucha en `127.0.0.1` en el puerto `POSTGRES_PORT` (5432 por defecto); si está ocupado, use otro puerto, por ejemplo 5433, en `.env`. Las cargas y resultados quedan en `backend/media/`, ignorado por Git.

API: `http://localhost:8000/api/v1/`. La raíz `http://localhost:8000/` redirige a Swagger en `/api/docs/`. Salud: `http://localhost:8000/health/` (`200` si PostgreSQL responde, `503` si no). El worker muestra «Esperando trabajos» al arrancar y permanece abierto en otra consola; solo procesa cuando existe un análisis en cola. Se detiene con Ctrl+C. Las migraciones son un paso explícito, no se ejecutan automáticamente en cada arranque.

### Documentación interactiva de la API

- Swagger UI: `http://localhost:8000/api/docs/`; ReDoc: `http://localhost:8000/api/redoc/`; esquema OpenAPI: `http://localhost:8000/api/schema/` (agregue `?format=json` para JSON).
- Las operaciones están agrupadas en **Autenticación**, **Mi cuenta**, **Administración de usuarios**, **Roles y permisos**, **Áreas de estudio**, **Imágenes satelitales**, **Modelos**, **Análisis** y **Resultados**. Swagger permite filtrar por nombre o ruta.
- Para probar una operación protegida, ejecute `POST /api/v1/auth/token/` con `username` y `password`. Pulse **Authorize** e introduzca el valor de `access` (sin el prefijo `Bearer`); Swagger enviará el encabezado `Authorization: Bearer <access>`. Al caducar, use `POST /api/v1/auth/token/refresh/` con `refresh` e introduzca el nuevo access token.
- En la carga de imágenes seleccione `multipart/form-data`, complete los campos y elija un archivo `.tif` o `.tiff` en `file`. En `POST /api/v1/analyses/`, seleccione `study_area`; el ejemplo **Análisis de una imagen** usa un solo `image_ids` y omite `model_id`. El backend omite v9 automáticamente cuando recibe una sola imagen. Consulte `GET /api/v1/analyses/{id}/` hasta `completed` o `failed`. Cada resultado expone sus enlaces `preview_url`, `download_url` y, si es raster, `metadata_url`. En Swagger las tres operaciones de **Resultados** solo piden `artifact_id`.
- Los IDs son creados por el servidor. Para seleccionar una imagen, modelo o recurso existente en Swagger, obtenga su ID en el listado correspondiente; Swagger UI no vincula automáticamente una respuesta con el formulario de otra operación. La futura interfaz de usuario hará esa selección sin mostrar IDs.
- Las rutas de administración requieren rol `admin` o superusuario. `401` indica token ausente o inválido; `403`, permisos insuficientes; `400`, datos rechazados; `404`, recurso inexistente o ajeno. Las operaciones de listado devuelven páginas de 20 elementos por defecto.

### Arranques posteriores

Antes de iniciar Django o el worker, abra Docker Desktop y, desde la raíz del repositorio, ejecute `docker compose up -d --wait db`. El comando espera hasta que PostgreSQL esté sano; `docker compose ps` debe mostrar `db` como `healthy`. Después, en sendas consolas dentro de `backend/`, active `.venv` y ejecute `py manage.py runserver` y `py manage.py run_analysis_worker`, respectivamente. Si ambos muestran `connection timeout expired`, compruebe primero `docker compose ps` y vuelva a iniciar `db`; no necesita recrear la base ni ejecutar migraciones de nuevo.

## Flujo de análisis

1. Registrar usuario en `POST /api/v1/auth/register/`; obtener JWT con `POST /api/v1/auth/token/` y renovar con `POST /api/v1/auth/token/refresh/`.
2. Crear área en `POST /api/v1/study-areas/`.
3. Cargar cada GeoTIFF multibanda en `POST /api/v1/images/` con `multipart/form-data`: `study_area` y `file`; `name` es opcional. El servidor extrae la fecha de adquisición de los metadatos o del nombre del archivo (por ejemplo, `2025_01_19`), detecta la escala de reflectancia y el factor SCL, y devuelve esos valores como campos de solo lectura. `uploaded_at` registra por separado la fecha de carga. Si no puede inferir algún dato de forma segura, la API explica el motivo y rechaza el archivo.
4. Crear análisis con `POST /api/v1/analyses/`: `name`, `study_area`, `image_ids` (uno o varios) y `model_id` opcional. Con una imagen se calculan automáticamente NDVI, NDMI, NBR y NDRE sin v9; con varias fechas hay diferencias e indicios de degradación. El modelo v9 requiere al menos dos escenas con SCL y se ejecuta desde 35 días, sin máximo, respetando sus demás requisitos de entrada.
5. Consultar estado y resumen en `GET /api/v1/analyses/{id}/`. El worker guarda mapas PNG de los raster y las láminas `visualizacion_individual.png` y, si hay varias fechas, `visualizacion_comparativa.png`. Usar el `download_url` de estos artefactos para obtenerlos. Los GeoTIFF originales siguen disponibles; `preview_url` genera una miniatura de cada raster. Cada ruta de **Resultados** pide un único `artifact_id` y comprueba que el archivo pertenece al usuario. Las rutas antiguas con ID del análisis siguen funcionando para clientes existentes.

Para registrar PNG en análisis completados antes de esta función, desde `backend/` ejecute `py manage.py backfill_analysis_visualizations --analysis-id 15`. Puede repetir `--analysis-id` para varios análisis; el comando es idempotente y requiere conservar resultados y escenas normalizadas.

Todos los recursos del usuario se filtran por propietario. Los resultados no se publican como archivos estáticos. El cierre de sesión se realiza con `POST /api/v1/auth/logout/` y el refresh token. El cliente debe descartar su access token; el refresh token queda invalidado.

El usuario puede cambiar su contraseña con `POST /api/v1/auth/password/change/`; se invalidan los tokens anteriores. Un administrador puede listar, crear y editar cuentas en `/api/v1/admin/users/`, incluida su activación y rol. Las cuentas se desactivan sin borrar sus análisis.

Un análisis terminado puede eliminarse con `DELETE /api/v1/analyses/{id}/`; esto elimina su registro y sus resultados. Los análisis en cola o en ejecución no se eliminan para evitar carreras con el worker.

## Copias de seguridad, retención y recuperación

Antes de crear una copia, detenga Django y el worker; mantenga PostgreSQL activo. Desde `backend/`, con `.venv` activo:

```powershell
py manage.py backup_forestguard --destination ../backups
py manage.py verify_forestguard_backup --backup-dir ../backups/forestguard-AAAAMMDDTHHMMSSZ
```

Cada copia contiene `database.dump`, una copia de `media/` y `manifest.json` con SHA-256. El directorio `backups/` está ignorado por Git; guarde además una copia en otra unidad protegida. Compruebe periódicamente la restauración en una instalación aislada. La [guía de operación de datos](docs/operacion_datos.md) explica la restauración y los límites de consistencia.

Por defecto no se borran cargas ni resultados automáticamente. Para revisar análisis `completed` o `failed` terminados hace más de 90 días y, opcionalmente, cargas antiguas que quedarían sin uso:

```powershell
py manage.py prune_analysis_data --older-than-days 90 --include-unused-uploads
```

Para aplicar la limpieza, detenga API y worker y use `--execute` y `--backup-dir` con una copia íntegra de menos de 24 horas. El comando elimina registros y archivos de esos análisis; nunca toca trabajos `queued` o `running`. No programe la limpieza hasta acordar una política de conservación de datos con los usuarios.

El worker actualiza un latido cada 30 segundos. En el siguiente ciclo de espera marca como `failed` un trabajo `running` sin latido durante 15 minutos; no lo reintenta ni elimina sus archivos. Después de actualizar el backend, detenga el worker, ejecute `py manage.py migrate` y reinícielo para activar esta recuperación.

## Entrada aceptada

La API recibe un **GeoTIFF de una sola grilla** con descripciones inequívocas `B2, B3, B4, B5, B8, B11, B12` y opcionalmente `SCL`. La fecha, escala de reflectancia y el factor SCL se detectan en el servidor. El worker normaliza el archivo sin alterar el original. Sin SCL se permiten índices descriptivos, pero no clasificación ML. SAFE L2A y COG por banda todavía no tienen endpoint de carga; sus metadatos y estructura necesitan una interfaz propia.

## Desarrollo y pruebas

```powershell
Set-Location backend
& ./.venv/Scripts/Activate.ps1
py manage.py check
py manage.py makemigrations --check --dry-run
py -m pytest -q --cov=accounts --cov=catalog --cov=analyses
py -m ruff check accounts catalog analyses backend tests
py manage.py spectacular --validate --fail-on-warn
```

Pytest usa una base temporal de PostgreSQL creada por Django; no modifica las tablas de desarrollo. Las pruebas del pipeline deben usar escenas sintéticas o recortes pequeños y una salida aislada.

`tests/test_real_raster.py` permite una comprobación adicional con GeoTIFF Sentinel-2 reales. Indique la ruta local de la primera escena con `FORESTGUARD_REAL_TEST_RASTER` y su fecha `AAAA-MM-DD` con `FORESTGUARD_REAL_TEST_DATE`; agregue `FORESTGUARD_REAL_TEST_RASTER_2` y `FORESTGUARD_REAL_TEST_DATE_2` para comprobar un intervalo. Si ambas escenas incluyen SCL, indique `FORESTGUARD_REAL_TEST_SCL_FACTOR` (`1` o `10000`) y `FORESTGUARD_REAL_TEST_USE_MODEL=1` para ejecutar v9. Ejecute `py -m pytest -q tests/test_real_raster.py` con `.venv` activo. La prueba se omite cuando faltan las variables de la primera escena, usa una base temporal y guarda los resultados en un directorio temporal. Comprueba carga, normalización, ejecución y artefactos, pero una clasificación ejecutada no demuestra la calidad del modelo ML ni valida su transferencia geográfica.

## Variables de entorno

`POSTGRES_DB`, `POSTGRES_USER` y `POSTGRES_PASSWORD` configuran PostgreSQL; `POSTGRES_HOST=127.0.0.1` y `POSTGRES_PORT=5432` conectan el backend local con el puerto publicado por Docker. `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` y `DJANGO_SECURE_COOKIES` configuran el servidor; `MAX_UPLOAD_BYTES` fija el tamaño máximo por archivo. `MEDIA_ROOT` y `PIPELINE_ROOT` usan por defecto `backend/media` y `backend/pipeline`. En despliegues públicos se debe terminar TLS delante de la API y configurar dominios y cookies seguras; `runserver` es para desarrollo local.

## Arquitectura y modelo de datos

Ver [arquitectura](docs/arquitectura.md), [contrato de la API](docs/api.md), [guía de integración posterior con React](docs/integracion-react.md) y [contrato del pipeline](backend/pipeline/README.md). La base PostgreSQL guarda usuarios, áreas, metadatos de imágenes, trabajos y referencias a resultados. Los archivos raster se guardan en un volumen persistente fuera de PostgreSQL. El modelo v9 se distribuye dentro del backend como paquete confiable y se registra con `sync_pipeline_model`; no hay carga de modelos arbitrarios desde la API.

Si un trabajador se interrumpe y deja un análisis en `running`, revisar primero desde `backend/`, con `.venv` activo, usando `py manage.py fail_stale_analyses --older-than-hours 24 --dry-run`. Repetir sin `--dry-run` solo después de comprobar que el trabajador no sigue procesando ese análisis.
