# Integración posterior con React

El frontend actual contiene datos simulados y todavía no llama a la API. Esta guía describe el contrato que debe usar cuando se autorice su integración. La base local es `http://localhost:8000/api/v1/`; el esquema completo está en `/api/schema/` y Swagger en `/api/docs/`.

## Sesión y usuarios

1. `POST /auth/register/` con `username`, `email`, `password`, `first_name`, `last_name`. La respuesta crea un analista; no inicia sesión automáticamente.
2. `POST /auth/token/` con `username` y `password` devuelve `access` y `refresh` en JSON. Enviar `Authorization: Bearer <access>` en rutas protegidas.
3. Ante `401` por expiración, llamar una vez a `POST /auth/token/refresh/` con el refresh vigente. Guardar el refresh nuevo: el anterior queda revocado por rotación. Si falla, limpiar la sesión y volver a iniciar sesión.
4. `GET /auth/me/` obtiene `id`, `username`, `email`, `first_name`, `last_name`, `role`, `is_active`, `date_joined`. `PATCH /auth/me/` modifica nombre, apellido y correo. `POST /auth/password/change/` exige contraseña actual y nueva; después hay que volver a iniciar sesión.
5. `POST /auth/logout/` revoca el refresh enviado. El cliente también debe borrar los tokens locales. La API devuelve los JWT en el cuerpo; no configura cookies de sesión para React.

`role` usa `analyst` o `admin`, no etiquetas de presentación. `GET/POST/PATCH /admin/users/` exige `admin`. Las listas usan el formato paginado `{count, next, previous, results}` y `?search=` / `?ordering=`. `date_joined` es fecha y hora del servidor; no se edita. Se desactiva una cuenta con `PATCH {"is_active":false}` en lugar de borrarla. No existe un rol `Consulta` ni eliminación de cuentas en la API.

## Flujo de análisis

1. `POST /study-areas/` con `name`, `department`, `municipality` y `description`; guardar el `id` devuelto.
2. Por cada escena, `POST /images/` como `multipart/form-data` con `study_area` y `file` GeoTIFF; `name` es opcional. No pida al usuario fecha, escala de reflectancia ni factor SCL: el backend los detecta y devuelve junto con el `id`. Muestre `acquisition_date` y la cobertura válida de la respuesta para que el usuario compruebe que corresponde a su escena. Si el nombre o los metadatos no contienen una fecha de adquisición inequívoca, muestre el error de la API y pida un archivo con la fecha verdadera en su nombre o metadatos. `uploaded_at` es la fecha de carga.
3. `GET /models/` lista modelos confiables activos. Crear un análisis con `POST /analyses/` y `{ "name": "...", "study_area": 1, "image_ids": [1, 2], "model_id": 1 }`. `model_id` es opcional: una sola fecha admite índices sin ML; el modelo v9 requiere dos o más fechas con SCL. El backend ordena cronológicamente las escenas. Puede omitir la clasificación de un intervalo fuera del contrato del modelo y explica el motivo en `summary`.
4. La creación devuelve `status=queued`. Consultar `GET /analyses/{id}/` hasta `completed` o `failed`; `running` no informa un porcentaje real. `error_message` explica un fallo técnico. `summary` contiene las estadísticas y límites científicos; no son probabilidades de riesgo futuro.
5. En `artifacts`, usar `id`, `kind` y `preview_url`. Para cada raster, `preview_url` apunta a `/api/v1/artifacts/{artifact_id}/preview/`: no necesita el ID del análisis ni un tamaño elegido por el usuario. Las rutas existentes `/analyses/{id}/artifacts/{artifact_id}/metadata/` (CRS, límites WGS84 y leyenda) y `/download/` (GeoTIFF original) siguen disponibles. El PNG necesita el JWT igual que el resto de la API; un `<img src>` sin cabecera Bearer no basta. Un `fetch` autenticado y un object URL sirven para mostrarlo. PDF y JSON usan `/download/`.

`GET /analyses/?search=...&ordering=-created_at` alimenta historial. El borrado se permite solo cuando el estado es `completed` o `failed`. Las fechas, áreas y métricas deben provenir de `summary`; no hay valores fijos por zona en la API.

## Diferencias que debe resolver la futura integración

| Pantalla actual | Contrato real |
| --- | --- |
| `AuthContext` inicia con un administrador simulado autenticado | Consultar `/auth/me/` con un JWT válido; iniciar sin sesión si no existe. |
| Registro comprueba confirmación solo en el navegador | Enviar `password`; mostrar también los errores de validación devueltos por la API. |
| Perfil edita `username` y contraseña sin contraseña actual | `username` es fijo en `/auth/me/`; contraseña usa `/auth/password/change/` con la actual. |
| Usuarios usa etiquetas `Admin`, `Analista`, `Consulta`, y ofrece borrar | Traducir `admin`/`analyst` solo para mostrar; desactivar en vez de borrar. |
| Nuevo análisis exige siempre modelo y simula progreso porcentual | El modelo es opcional y la API expone estados, no porcentaje de avance. |
| Modelos muestra cargas y modelos de incendio/riesgo simulados | `/models/` es de solo lectura y contiene únicamente el modelo v9 confiable. Riesgo futuro sigue fuera del alcance. |
| Resultados e historial usan cifras e imágenes fijas | Usar `summary`, artefactos, miniaturas y metadatos del análisis terminado. |

Para errores, esperar `400` por validación, `401` por sesión inválida, `403` por permisos, `404` para recursos ajenos o ausentes y `429` por exceso de solicitudes. No mostrar al usuario como resultado científico un análisis en cola o fallido.
