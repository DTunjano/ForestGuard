# Contrato inicial de la API

Base: `/api/v1/`. La documentación generada por el código está en `/api/docs/`, `/api/redoc/` y `/api/schema/`. Las peticiones protegidas usan `Authorization: Bearer <access-token>`.

## Autenticación

`POST /auth/register/` recibe `username`, `email`, `password` y, opcionalmente, `first_name` y `last_name`. El correo se guarda en minúsculas y no puede repetirse con otra combinación de mayúsculas. Los nuevos usuarios tienen rol `analyst`. `POST /auth/token/` recibe `username` y `password`, y devuelve `access` y `refresh`. `POST /auth/token/refresh/` recibe `refresh`; rota el token. Los tres endpoints públicos de autenticación comparten un límite de 10 solicitudes por minuto por cliente.

`POST /auth/logout/` recibe el `refresh` actual y lo revoca. `GET/PATCH /auth/me/` consulta o edita nombre, apellido y correo propios. `POST /auth/password/change/` recibe `old_password` y `new_password`; devuelve `204` y revoca los tokens anteriores, incluido el access token. El cliente debe borrar sus tokens y volver a iniciar sesión. No hay restablecimiento de contraseña por correo: requiere configurar antes un servicio de envío fiable.

`GET/POST/PATCH /admin/users/` permite a un administrador listar, crear y editar usuarios. La creación requiere `username`, `email` y `password`; admite `role` (`analyst` o `admin`) e `is_active`. La edición admite rol y estado, pero un administrador no puede desactivar su propia cuenta ni quitarse su propio rol. Las cuentas se desactivan sin borrar los análisis históricos. No se expone eliminación de usuarios. Las listas de usuarios admiten `search` y `ordering`.

## Imágenes y áreas

```json
POST /study-areas/
{"name":"Sector 05","department":"Meta","municipality":"La Macarena"}
```

`GET /study-areas/`, `GET /study-areas/{id}/`, `PATCH /study-areas/{id}/` y `DELETE /study-areas/{id}/` operan solo sobre áreas propias. Un área con imágenes no se puede eliminar.

`POST /images/` recibe `multipart/form-data`:

| Campo | Ejemplo | Condición |
| --- | --- | --- |
| `study_area` | `1` | Debe pertenecer al usuario. |
| `name` | `Escena mayo 2024` | Opcional; se usa el nombre del archivo si se omite. |
| `file` | `escena.tif` | GeoTIFF con descripciones de las siete bandas. |

La respuesta `201` devuelve identificador, `acquisition_date`, `reflectance_scale`, `scl_factor` y otros metadatos detectados. Estos tres campos son de solo lectura. La fecha de adquisición procede de etiquetas de adquisición del GeoTIFF o del nombre (`AAAA_MM_DD`, `AAAA-MM-DD` o `AAAAMMDDThhmmss`); la fecha actual de carga se registra aparte en `uploaded_at`. Si no hay una fecha inequívoca, el archivo debe aportar esos metadatos o renombrarse con su fecha verdadera. Nunca se asigna la fecha actual como adquisición. La escala radiométrica (`fraction` o `divide_10000`) y el factor SCL (`1` o `10000`) se infieren del contenido; si la inferencia es ambigua, se rechaza con `400`.

Errores de formato, bandas, SCL, tamaño y ausencia de píxeles válidos devuelven `400`. La validación recorre ventanas de hasta 512 × 512, aplica la escala detectada y exige reflectancia finita entre 0 y 1 en las siete bandas; si hay SCL, solo acepta clases 4/5 con el factor detectado. `GET /images/` lista las escenas del usuario; `DELETE /images/{id}/` elimina una imagen que no esté usada en un análisis.

Se aceptan descripciones de banda canónicas (`B2`) y con cero inicial (`B02`), opcionalmente seguidas de texto descriptivo. Se rechazan bandas requeridas duplicadas, GeoTIFF sin CRS y archivos que declaran escala u offset por banda. El worker vuelve a comprobar el contenido radiométrico al normalizar. La aceptación de una escena individual no garantiza que dos escenas compartan píxeles válidos para compararlas.

## Análisis

```json
POST /analyses/
{
  "name": "Cambio mayo-septiembre",
  "description": "Análisis histórico exploratorio",
  "study_area": 1,
  "image_ids": [11, 12],
  "model_id": 1
}
```

Para una sola imagen use, por ejemplo, `{"name":"Índices de una escena","study_area":1,"image_ids":[11]}`. El área se elige explícitamente; todas las imágenes deben pertenecer a ella. Con una imagen el backend omite v9 automáticamente, incluso si se envió `model_id`, y calcula NDVI, NDMI, NBR y NDRE con sus estadísticas. De 2 a 32 fechas distintas se generan comparaciones de intervalos consecutivos; `model_id` es opcional y v9 requiere al menos dos escenas con SCL. La creación devuelve `201` y `status=queued`. `GET /analyses/{id}/` devuelve `queued`, `running`, `completed` o `failed`, además de fechas, error, resumen y artefactos. No se debe interpretar `queued` como resultado disponible.

Un resultado completo incluye `resumen_serie.json`, mapas GeoTIFF, una versión PNG descargable de cada raster y `reporte.pdf`. Las fechas individuales tienen dos láminas: `visualizacion_individual.png` (ocre–verde) y `visualizacion_individual_contraste.png` (rojo–neutro–azul). Ambas reúnen el color natural, mapas NDVI, NDMI, NBR y NDRE, sus medias y percentiles p10/p90, más una gráfica de distribución. En la segunda, el rojo representa un **valor bajo del índice en esa fecha**, no pérdida temporal. Para varias fechas, `visualizacion_comparativa.png` reúne los mapas dNDVI, dNDMI, dNBR y dNDRE, sus métricas, los indicios espectrales y v9 cuando se ejecutó; si v9 no se ejecutó, muestra una gráfica de distribución de cambios en ese recuadro. Además, cada fecha tiene `fechas/AAAA-MM-DD/resumen_fecha.png` y `resumen_fecha_contraste.png`; cada intervalo tiene `intervalos/FECHA_INICIAL_FECHA_FINAL/resumen_cambio.png`. En `GET /analyses/{id}/`, `summary` contiene todas las métricas sin descargar archivos. Para consultar los resultados sin buscar IDs de artefactos, use `GET /analyses/{id}/results/`. Agrupa informe, métricas, resultados individuales y comparaciones; el parámetro opcional `section=summary|individual|comparison|all` muestra solo la parte elegida. Cada GeoTIFF tiene un nombre legible y enlaces para descargar el original o su PNG. Un raster `.tif` conserva valores y coordenadas, pero muchos visores lo muestran en grises. La imagen PNG incluye los colores de visualización; no sustituye los valores georreferenciados.

`GET /analyses/{id}/export/?format=png` descarga un ZIP con resumen JSON, informe PDF, mapas PNG en color y láminas de resultados. Abra primero `visualizacion_individual.png`, `visualizacion_individual_contraste.png` o `visualizacion_comparativa.png` en la raíz del ZIP; `LEEME_RESULTADOS.txt` explica el contenido. Los mapas por índice y los resúmenes de cada fecha o intervalo están en `png/`. `format=tiff` incluye los GeoTIFF originales en lugar de las láminas PNG; `format=both` incluye ambos. El parámetro opcional `section=individual|comparison|summary|all` limita el contenido; los archivos de resumen permanecen incluidos. En Swagger se introduce el ID del análisis una sola vez y se eligen formato y sección, sin buscar IDs de artefactos. La exportación requiere un análisis completado. `DELETE /analyses/{id}/` se permite después de completar o fallar y borra resultados y copias normalizadas.

Para un artefacto `kind=raster`, el detalle del análisis incluye `preview_url` y `metadata_url`. `GET /api/v1/artifacts/{artifact_id}/preview/` devuelve una vista PNG; `GET /api/v1/artifacts/{artifact_id}/download/?format=png` descarga el mapa PNG con **el mismo ID** que el GeoTIFF; `format=tiff` descarga el original. `GET /api/v1/artifacts/{artifact_id}/metadata/` devuelve dimensiones, CRS, límites en WGS84 (`bounds_wgs84` como oeste, sur, este, norte), descripción de banda y leyenda. Las rutas previas `GET /analyses/{id}/artifacts/{artifact_id}/...` siguen funcionando para clientes existentes, pero no se muestran en Swagger. Estas rutas exigen el JWT del propietario. Las clases de cambio son exploratorias y la leyenda no las presenta como riesgo futuro.

### Prueba de una sola imagen en Swagger

1. Inicie PostgreSQL, `py manage.py runserver` y, en otra consola con el mismo entorno virtual, `py manage.py run_analysis_worker`. Abra `/api/docs/` y use **Authorize** con el token `access` obtenido en `POST /api/v1/auth/token/`.
2. Cree o consulte su área con `POST /api/v1/study-areas/` o `GET /api/v1/study-areas/` y conserve su ID.
3. En `POST /api/v1/images/`, seleccione el área y suba el GeoTIFF Sentinel-2. La respuesta indica el ID de la imagen y los metadatos detectados.
4. En `POST /api/v1/analyses/`, seleccione el ejemplo **Análisis de una imagen** y envíe `{"name":"Prueba individual","study_area":ID_AREA,"image_ids":[ID_IMAGEN]}`. No es necesario indicar `model_id`; el análisis individual calcula índices sin v9.
5. Consulte `GET /api/v1/analyses/{id}/` hasta que `status` sea `completed`. Abra `GET /api/v1/analyses/{id}/results/` para ver métricas, mapas y lámina individual; use `section=individual` para ocultar las otras secciones.
6. Descargue `GET /api/v1/analyses/{id}/export/` eligiendo `format=png`, `tiff` o `both`. Para un mapa concreto, `GET /api/v1/artifacts/{artifact_id}/download/` acepta `format=png` o `tiff` con el mismo ID.

## Errores y límites

La API usa errores DRF estándar: `400` para validación, `401` para autenticación ausente o inválida, `403` para acciones de administrador, `404` para recursos ajenos o inexistentes y `429` para exceso de solicitudes. Los fallos del pipeline se almacenan en el análisis con `status=failed`. El cliente no debe traducir una omisión de clasificación en ausencia de deforestación: el resumen indica `estado_clasificacion=omitida` y el motivo.

Las listas de áreas, imágenes, modelos y análisis aceptan `?search=texto` y `?ordering=campo` o `?ordering=-campo`. Solo se buscan recursos visibles para el usuario; los campos permitidos de ordenamiento se publican en OpenAPI.

## Actualización: cobertura y permisos

Consulte [Cobertura y roles](cobertura-y-roles.md) para el contrato de
`summary.escenas[].condicion` y `summary.intervalos[].condicion`, el informe PDF,
las láminas original/resultado y los endpoints `/api/v1/admin/roles/` y
`/api/v1/admin/permissions/`. `role_ids` asigna múltiples roles; los permisos de
Django son la autoridad efectiva. Se conserva `role` para clientes anteriores.
