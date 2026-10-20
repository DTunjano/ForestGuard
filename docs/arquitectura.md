# Arquitectura del backend

## Alcance

Se integró el paquete `forestguard_pipeline_historico_v7` como herramienta local confiable. El backend organiza solicitudes y permisos; el paquete realiza normalización, cálculo geoespacial e inferencia. El resultado ML es cambio histórico exploratorio, no una predicción futura ni una confirmación oficial de deforestación. La degradación se comunica como indicio espectral.

## Capas y módulos

```text
backend/
  backend/       configuración, rutas y esquema OpenAPI
  accounts/      usuario, JWT y permisos
  catalog/       áreas, GeoTIFF y modelo registrado
  analyses/      trabajos, escenas ordenadas, ejecución y artefactos
  pipeline/      paquete portable v7 y modelo v9
  tests/         contratos y flujos de integración
```

La API recibe y valida metadatos y archivos. PostgreSQL, el único servicio en Docker Compose, guarda la relación entre usuarios, áreas, escenas, análisis y artefactos. Django y un proceso trabajador separado se ejecutan desde el entorno virtual local; el trabajador toma trabajos en cola con bloqueo de fila, normaliza cada escena y llama al pipeline. Los GeoTIFF originales, copias normalizadas y resultados viven en `backend/media/`, compartido por ambos procesos locales e ignorado por Git. Las rutas de archivos nunca se reciben desde el cliente para ejecutar el pipeline. El módulo `raster_preview` lee un raster de resultado a resolución limitada y genera una vista PNG temporal para el mapa; la API entrega además CRS, límites WGS84 y leyenda, sin publicar la carpeta de archivos.

## Diferencias justificadas frente al diagrama inicial

- `User` extiende la autenticación de Django y almacena contraseñas con el hash del framework; no se crea una tabla `password` separada.
- `StudyArea` es propiedad de un usuario. `SatelliteImage` almacena fecha, banda, CRS, tamaño y parámetros radiométricos, imprescindibles para validar el contrato.
- `AnalysisImage` conserva orden cronológico; el análisis admite de 1 a 32 escenas. No se exige una comparación para la modalidad de una imagen.
- `Analysis` tiene estados, tiempos, error y resumen JSON. `ResultArtifact` representa los mapas y reportes; evita una tabla por cada tipo de raster.
- `PipelineModel` registra solo el modelo confiable incluido en el paquete, con perfil de desempeño. Su ruta se resuelve dentro del paquete y no se acepta desde peticiones externas.
- Los tamaños son enteros en bytes, las fechas usan tipos temporales y las métricas del pipeline permanecen en JSON estructurado, sin convertirlas a porcentajes de certeza.

## Decisiones de seguridad

JWT de 15 minutos, refresh de 7 días con rotación y lista de revocación. Los tokens incorporan una huella de la contraseña: al cambiarla se invalidan también los access tokens anteriores. El registro público siempre crea analistas; el inicio de sesión, la renovación y el registro tienen límite de solicitudes. Los objetos se filtran por propietario y las descargas comprueban pertenencia y ruta interna. Las cargas se limitan por tamaño y se inspeccionan con Rasterio. CORS permite únicamente orígenes declarados. Los secretos se leen de `.env` y este archivo está ignorado por Git. El modelo `joblib` se incluye como archivo confiable; la API no acepta modelos enviados por usuarios.

## Limitaciones actuales

La API acepta inicialmente GeoTIFF multibanda de una sola grilla. El paquete también contiene normalizadores para SAFE L2A y COG por banda, que requieren endpoints y metadatos propios. El worker basado en PostgreSQL permite ejecución separada y evita bloquear solicitudes, y permite recuperar fallos inesperados. Si un proceso se interrumpe sin registrar el fallo, el operador puede usar `python manage.py fail_stale_analyses --older-than-hours 24 --dry-run` y luego repetir sin `--dry-run` para marcar trabajos abandonados como fallidos. Aún hace falta una política de retención para despliegue continuo. No hay estimación de riesgo futuro.
