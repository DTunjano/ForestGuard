# Integración React y contrato de API

La integración local se desarrolla en integration/frontend-backend.
Consulta [arquitectura, ejecución, sesión y pruebas](integracion-local.md).
Swagger sigue disponible en /api/docs/ y el esquema en /api/schema/.

## Flujos conectados

| Pantalla | Contrato |
| --- | --- |
| Registro / login | POST auth/register/, auth/token/; recuperación con token/refresh/ y auth/me/ |
| Perfil | GET/PATCH auth/me/; POST auth/password/change/; volver a ingresar al cambiar contraseña |
| Usuarios (admin) | GET/POST/PATCH admin/users/; roles admin/analyst; desactivación, sin borrado |
| Modelos | GET models/ paginado; catálogo de solo lectura |
| Áreas | GET/POST study-areas/; selección por nombre, ID interno |
| Nuevo análisis | POST images/ multipart; GET images/?study_area=; POST analyses/ |
| Historial | GET analyses/?search=&ordering=&page= |
| Resultados | GET analyses/{id}/ y results/; polling solo en queued/running |
| Descargas | URL privada devuelta por el backend; Bearer JWT; blob y objectURL |
| Dashboard | count del servidor para áreas, imágenes y análisis; últimos cinco análisis |

La entrada necesita bandas descritas B2, B3, B4, B5, B8, B11 y B12;
SCL es opcional para índices y necesaria para v9. El servidor detecta fecha de
adquisición, escala y SCL. No se envían valores radiométricos desde el formulario.
La carga informa dimensiones y metadatos; **la cobertura válida exacta aparece
después en summary**, no existe ese campo en la respuesta de carga.

Una imagen produce índices sin modelo; varias imágenes distintas del área y
con fechas diferentes permiten comparar. Se admiten fechas del mismo año, máximo
32. El modelo es opcional y el servidor decide la compatibilidad de cada intervalo;
la omisión y su motivo se muestran en los resultados.

summary.escenas contiene índices y cobertura por fecha. summary.intervalos
contiene diferencias, área común, indicios y clasificación. No se suman áreas
solapadas. p10–p90 son percentiles de píxeles válidos, no confianza ni exactitud.

Los grupos reports, individual, comparisons y other de results/ ofrecen
archivos reales y URLs autenticadas. La vista filtra por grupo, fecha/intervalo e
índice; las láminas generales se ocultan al filtrar una fecha concreta.
Cada raster permite PNG y GeoTIFF. Los informes PDF/JSON y las láminas PNG se
descargan en su formato original. El ZIP completo permite png, tiff o both y no
depende de los filtros visuales.

## Errores y permisos

400: validación; 401: sesión inválida; 403: permiso insuficiente; 404: recurso
inexistente o ajeno; 429: límite de solicitudes. El cliente presenta el error y no
inventa resultados. Las imágenes privadas se obtienen como blobs autenticados,
nunca como enlaces públicos a media. La autorización efectiva sigue en Django.

## Fuera de la interfaz actual

La API conserva edición/eliminación de áreas, eliminación de imágenes sin uso y
de análisis terminados. No se añadieron controles destructivos a la web: su
ciclo de vida continúa manual mediante API, con sus validaciones. Tampoco hay
pantallas para instalar modelos, cargar SAFE/COG por banda, recuperar contraseña
por correo ni evaluar científicamente v9. No se simulan esas operaciones.
