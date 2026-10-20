# Contrato inicial de la API

Base: `/api/v1/`. La documentación generada por el código está en `/api/docs/`, `/api/redoc/` y `/api/schema/`. Las peticiones protegidas usan `Authorization: Bearer <access-token>`.

## Autenticación

`POST /auth/register/` recibe `username`, `email`, `password`, `first_name` y `last_name`. Los nuevos usuarios tienen rol `analyst`. `POST /auth/token/` recibe `username` y `password`, y devuelve `access` y `refresh`. `POST /auth/token/refresh/` recibe `refresh`; rota el token. `POST /auth/logout/` recibe el `refresh` actual y lo revoca. `GET/PATCH /auth/me/` consulta o edita nombre, apellido y correo propios. La administración de usuarios está limitada a `GET/PATCH /admin/users/` para el rol `admin`.

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

La respuesta `201` devuelve identificador y metadatos inspeccionados. Errores de formato, bandas, SCL y tamaño devuelven `400`. `GET /images/` lista las escenas del usuario; `DELETE /images/{id}/` elimina una imagen que no esté usada en un análisis.

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

## Errores y límites

La API usa errores DRF estándar: `400` para validación, `401` para autenticación ausente o inválida, `403` para acciones de administrador, `404` para recursos ajenos o inexistentes y `429` para exceso de solicitudes. Los fallos del pipeline se almacenan en el análisis con `status=failed`. El cliente no debe traducir una omisión de clasificación en ausencia de deforestación: el resumen indica `estado_clasificacion=omitida` y el motivo.
