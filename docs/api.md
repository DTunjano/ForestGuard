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
| `name` | `Escena mayo 2024` | Nombre visible. |
| `acquisition_date` | `2024-05-17` | Fecha de adquisición, no de carga. |
| `reflectance_scale` | `fraction` | Alternativa: `divide_10000`. |
| `scl_factor` | `1` | Exigido si el raster tiene SCL; alternativa: `10000`. |
| `file` | `escena.tif` | GeoTIFF con descripciones de las siete bandas. |

La respuesta `201` devuelve identificador y metadatos inspeccionados. Errores de formato, bandas, SCL, tamaño y ausencia de píxeles válidos devuelven `400`. La validación recorre ventanas de hasta 512 × 512, aplica la escala declarada y exige reflectancia finita entre 0 y 1 en las siete bandas; si hay SCL, solo acepta clases 4/5 con el factor declarado. `GET /images/` lista las escenas del usuario; `DELETE /images/{id}/` elimina una imagen que no esté usada en un análisis.

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

`model_id` puede omitirse para índices y diferencias sin clasificación ML. Una escena genera índices; de 2 a 32 fechas distintas generan comparaciones de intervalos consecutivos. Para usar el modelo v9 se requieren al menos dos escenas con SCL. La creación devuelve `201` y `status=queued`. `GET /analyses/{id}/` devuelve `queued`, `running`, `completed` o `failed`, además de fechas, error, resumen y artefactos. No se debe interpretar `queued` como resultado disponible.

Un resultado completo incluye `resumen_serie.json`, mapas GeoTIFF y `reporte.pdf`. Cada artefacto se descarga con `GET /analyses/{id}/artifacts/{artifact_id}/download/`. La API verifica propiedad del análisis y sirve el archivo como adjunto. `DELETE /analyses/{id}/` se permite después de completar o fallar y borra resultados y copias normalizadas.

Para un artefacto `kind=raster`, `GET /analyses/{id}/artifacts/{artifact_id}/metadata/` devuelve dimensiones, CRS, límites en WGS84 (`bounds_wgs84` como oeste, sur, este, norte), descripción de banda y leyenda. `GET /analyses/{id}/artifacts/{artifact_id}/preview/?max_size=768` devuelve un PNG transparente de máximo 1024 píxeles por lado. La vista es una miniatura para la interfaz; el GeoTIFF descargable conserva la resolución y los valores originales. Ambas rutas exigen el JWT del propietario. Las clases de cambio son exploratorias y la leyenda no las presenta como riesgo futuro.

## Errores y límites

La API usa errores DRF estándar: `400` para validación, `401` para autenticación ausente o inválida, `403` para acciones de administrador, `404` para recursos ajenos o inexistentes y `429` para exceso de solicitudes. Los fallos del pipeline se almacenan en el análisis con `status=failed`. El cliente no debe traducir una omisión de clasificación en ausencia de deforestación: el resumen indica `estado_clasificacion=omitida` y el motivo.

Las listas de áreas, imágenes, modelos y análisis aceptan `?search=texto` y `?ordering=campo` o `?ordering=-campo`. Solo se buscan recursos visibles para el usuario; los campos permitidos de ordenamiento se publican en OpenAPI.
