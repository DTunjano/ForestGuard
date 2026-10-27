# Resultados compactos y acceso a detalles

## Presentación

El mapa principal conserva la imagen original, la cobertura y sus porcentajes. **Ver más detalles** abre el selector de indicadores y **Ocultar detalles** lo cierra sin alterar la capa elegida. La barra **Visibilidad del resto** y el restablecimiento están siempre presentes; los filtros de índice ya no ocupan espacio de forma permanente. El control se puede activar con Enter o Espacio y expone `aria-expanded` y `aria-controls`.

El resto de la página se organiza en:

1. **Descargar análisis completo**: un ZIP con PNG, GeoTIFF o ambos, más informe y métricas. La descarga conserva todos los resultados, independientemente de los filtros de pantalla.
2. **Resumen y métricas**: estadísticas por fecha y comparación disponibles en un desplegable, cerrado inicialmente. La clasificación complementaria v9 se consulta aquí.
3. **Archivos del análisis**: biblioteca por Resúmenes, Por fecha, Comparaciones, Informes y Otros, con una opción Todos. Se presentan como máximo seis archivos por página y se muestra una sola vista previa a la vez.

Seleccionar un archivo actualiza el visor y sus descargas. Los archivos de cada fecha y comparación conservan su periodo visible. Los PNG se previsualizan; los GeoTIFF ofrecen el mapa PNG y ambos formatos de descarga. Los PDF y JSON muestran su descripción y descarga. La búsqueda ignora tildes y permite buscar nombre, índice o fecha. El formato PNG incluye rasters que ofrecen una descarga PNG; no se pierden sus enlaces GeoTIFF.

Los botones **Archivos anteriores/siguientes** permiten recorrer el conjunto completo. Las categorías, fechas, búsqueda y formato se pueden restablecer; un estado vacío explica cómo recuperar resultados. Los artefactos siguen disponibles sin escribir IDs ni cargar cientos de imágenes al abrir la página. Solo se solicita la imagen del archivo seleccionado; al cambiar se cancela la solicitud anterior y se libera su object URL. Si falla, aparece **Reintentar visualización**.

## Arquitectura y compatibilidad

`Results.jsx` conserva la página y los estados de ejecución. `CompletedResults` reúne la presentación completada, exportación y métricas. `ArtifactExplorer` organiza el catálogo y la selección; `artifactCatalog.js` concentra nombres, agrupación y filtros. `ArtifactCard` mantiene las descargas autenticadas y la vista de un único archivo. No cambian los IDs, archivos, resultados, umbrales, propiedad ni contratos de descarga del backend.

El visor usa una distribución de dos paneles en escritorio y una sola columna en móvil. Las acciones de selección son botones nativos, con estado visible y `aria-pressed`, y el visor tiene una región identificable. Los filtros usan las etiquetas y selectores del sistema de diseño. La paginación limita el contenido renderizado; las miniaturas no se descargan para archivos no seleccionados.

Se aplican divulgación progresiva, reconocimiento de opciones y reducción de contenido secundario, tomando como referencias las [heurísticas de usabilidad de Nielsen Norman Group](https://www.nngroup.com/articles/ten-usability-heuristics/) y el [patrón de despliegue accesible de W3C](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/). Estas decisiones no constituyen una auditoría completa de conformidad WCAG.

## Verificación

Las pruebas de catálogo comprueban agrupación, periodos, identidad de archivos, búsqueda sin tildes y formatos descargables. El recorrido de navegador comprueba que solo hay un visor y un máximo de seis entradas, paginación, búsquedas vacías, selección y descargas PNG/TIFF/PDF/JSON/ZIP, visibilidad permanente de la barra y conservación de la capa al cerrar sus detalles. Incluye resultados individuales y comparativos y revisión a 390 px.

Verificación del 27 de octubre de 2026: **63 pruebas del backend y 10 del frontend aprobadas**, sin omisiones; suite con navegador y pipeline real, validación de Swagger, Ruff, lint, compilación y comprobaciones de Django correctas. Se revisaron las capturas de escritorio y móvil y se eliminó un espacio vertical innecesario del visor. No se requieren migraciones ni se modifica el contenido de los resultados existentes.
