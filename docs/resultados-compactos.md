# Resultados por niveles y acceso a detalles

## Presentación

La página ofrece tres niveles mediante botones con selección visible, `aria-pressed` y `aria-controls`:

1. **Resumen** (inicial): imagen original y mapa de cobertura, porcentajes y hectáreas, fecha o intervalo y cobertura válida. Incluye una lectura breve basada en la categoría con mayor porcentaje real del periodo, descarga de su **resumen PNG** y del **informe PDF** del estudio completo. Una escena describe condición; las comparaciones describen cambios. No se infieren resultados ausentes.
2. **Explorar índices**: mapas NDVI, NDMI, NBR y NDRE, láminas por fecha y de cambios, y estadísticas en un desplegable cerrado inicialmente. La clasificación complementaria v9 se consulta aquí. Las láminas con dos paletas ocupan una sola entrada: **Paleta del mapa** permite cambiar entre ocre–verde y rojo–azul. Si solo existe una variante, se conserva sin ofrecer una segunda inexistente. Los índices mantienen sus unidades y escalas; sus valores no se convierten en porcentajes de deforestación.
3. **Descargas técnicas**: paquete ZIP PNG, GeoTIFF o ambos, más informe y métricas. Una biblioteca completa conserva todos los archivos, incluidos JSON, máscaras, salidas complementarias del modelo y ambas variantes PNG originales. Su búsqueda, categorías, fechas, formato y paginación permiten localizar archivos para herramientas geográficas o procesamiento posterior. La descarga completa conserva todo el estudio independientemente de los filtros de pantalla.

Solo se muestra un nivel a la vez. Volver al resumen conserva la fecha y los filtros del mapa principal; los exploradores secundarios se abren bajo demanda y se restablecen al salir. La biblioteca presenta como máximo seis entradas por página y una sola vista previa. La pantalla inicial no despliega la lista de archivos ni las tablas técnicas. Los análisis antiguos sin categorías mantienen sus archivos disponibles en Descargas técnicas.

El mapa principal conserva **Ver más detalles**, que abre el selector de indicadores; cerrarlo no altera la capa elegida. La barra **Visibilidad del resto** permanece visible. El control responde a Enter/Espacio y expone `aria-expanded` y `aria-controls`.

Seleccionar un archivo actualiza el visor y sus descargas. Los archivos de cada fecha y comparación conservan su periodo visible. Los PNG se previsualizan; los GeoTIFF ofrecen el mapa PNG y ambos formatos de descarga. Los PDF y JSON muestran su descripción y descarga. La búsqueda ignora tildes. El filtro PNG incluye rasters con descarga PNG; no se pierden sus enlaces GeoTIFF. Los estados vacíos permiten restablecer la búsqueda. No se escriben IDs manualmente.

## Arquitectura y compatibilidad

`Results.jsx` conserva la página y los estados de ejecución. `CompletedResults` reúne los tres niveles, exportación y métricas. `ArtifactExplorer` recibe su propósito de exploración o biblioteca técnica; `artifactCatalog.js` concentra nombres, agrupación, variantes, filtros e interpretación de la categoría dominante. `ArtifactCard` mantiene las descargas autenticadas y la vista de un único archivo; `ResultDownload` gestiona las descargas principales y sus estados de espera/error.

No cambian los IDs, métricas, umbrales, propiedad ni contratos de descarga. Los PNG y GeoTIFF se conservan; el [informe PDF actualizado](informes-pdf.md) reúne las láminas PNG independientes y se renueva al descargar si su versión está desactualizada. `pnpm dev` y el funcionamiento del worker se conservan.

El visor usa dos paneles en escritorio y una columna en móvil. Las acciones son botones nativos con estado visible; los filtros usan el sistema de diseño. Solo se solicita la imagen seleccionada y se cancela su petición anterior al cambiar, liberando el object URL. Los fallos permiten reintentar. La biblioteca técnica conserva todos los archivos originales aunque la exploración agrupe sus paletas.

El área del archivo seleccionado reserva una altura de 760 px en escritorio y 660 px en móvil. Encabezado, paleta, carga, imagen y errores se distribuyen dentro de ese espacio, sin empujar las estadísticas al cambiar de archivo. Las imágenes se ajustan completas con `object-fit: contain`; la entrada suave respeta movimiento reducido. Las pruebas comprueban que la posición de las métricas varíe menos de 2 px durante la carga y después de cambiar de paleta o archivo.

Se aplica presentación progresiva y reconocimiento de opciones. Referencias de diseño: [heurísticas de Nielsen Norman Group](https://www.nngroup.com/articles/ten-usability-heuristics/) y [patrón de despliegue accesible de W3C](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/). No constituye una auditoría completa de conformidad WCAG.

## Verificación

Las pruebas del catálogo comprueban agrupación, periodos, identidad, búsqueda sin tildes, formatos, agrupación de paletas sin perder variantes y lectura con datos ausentes. El recorrido de navegador comprueba los tres niveles, descargas directas PDF/PNG, un visor y seis entradas como máximo, paginación y descargas PNG/TIFF/PDF/JSON/ZIP. Incluye resultados individuales y comparativos, navegación por teclado de los controles y presentación a 390 px. No se requieren migraciones ni se modifica el contenido de resultados personales.

Verificación del 27 de octubre de 2026: **12 pruebas del frontend aprobadas**, lint y compilación correctos. Aprobadas las dos comprobaciones de integración: recorrido completo de navegador con Django/PostgreSQL/worker/pipeline y verificación de mapas, informe y exportaciones del pipeline. El recorrido se repitió con las nuevas comprobaciones y capturas móviles y volvió a pasar. Se revisaron las capturas de escritorio y 390 px con mapas cargados. Solo permanecen los avisos de deprecación de Rasterio/Affine y de tiempo de plugins de compilación ya existentes.
