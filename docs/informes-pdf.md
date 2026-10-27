# Informes PDF de resultados

El informe utiliza los colores ForestGuard, encabezado y pie con número de estudio/página, tablas de porcentajes y hectáreas, mapas y una interpretación basada en las métricas existentes. Se aplica a una fecha o a varias; no vuelve a ejecutar el pipeline ni modifica índices o categorías.

## Orden de lectura

1. Portada con periodo destacado, porcentajes, interpretación y cobertura de cada escena.
2. Guía de colores, índices y p10-p90, seguida de un índice navegable y marcadores PDF.
3. Resumen de todas las fechas en las dos paletas disponibles.
4. Resultados por fecha, en orden cronológico: cobertura, estadísticas, interpretación, índices y referencias visuales PNG.
5. Resumen de comparaciones y detalle de cada intervalo: cobertura, cambios, métricas, interpretación y láminas disponibles.
6. Otros PNG independientes, si existen, y conclusiones por periodo con próximos pasos.

Se incorporan **todos los PNG independientes** de la carpeta de resultados. Un PNG que comparte nombre y ruta con un `.tif` o `.tiff` es una exportación técnica del mismo raster y no se repite como otra lámina. Permanece disponible para descargar desde la web o el ZIP. Se incluyen las dos paletas: son vistas de los mismos índices, no hallazgos distintos.

Las láminas generales altas se dividen por bloques de escena o intervalo, conservando todas sus filas de píxeles. Los originales no se editan. Cada figura tiene título, periodo y leyenda de interpretación. Las categorías usan porcentajes del área válida; los índices mantienen su escala. No se suman superficies de fechas superpuestas. Una sola escena describe condición, y las comparaciones describen cambios. El resultado v9 permanece identificado como complemento separado.

No se incluye una sección de método y trazabilidad. Los PNG existentes se incorporan como fueron generados y pueden conservar sus rótulos originales; la reconstrucción del PDF no reescribe esas imágenes.

## Informes existentes y API

Al descargar `reporte.pdf` por la ruta de artefacto actual o la ruta anterior, y al exportar un ZIP, se comprueba su vigencia. Si está desactualizado se reconstruye una vez y se actualiza el tamaño del mismo artefacto, conservando su ID. El PDF siempre corresponde al estudio completo, incluso al filtrar los mapas de un ZIP por sección.

La primera descarga de un informe antiguo puede tardar unos segundos. Las siguientes reutilizan el archivo. La comprobación utiliza una huella privada del resumen, los datos descriptivos y los PNG; no ejecuta el modelo ni el pipeline. El archivo interno `.reporte.version` no se registra como artefacto ni se expone en las respuestas. La autorización y el propietario se validan antes de regenerar. Un bloqueo por análisis evita reconstrucciones simultáneas.

También puede actualizarse desde `backend`, con el entorno virtual activo:

```powershell
py manage.py rebuild_analysis_reports --analysis-id 23
```

`--analysis-id` puede repetirse. Solo admite análisis completados con resumen y carpeta de resultados. La generación escribe primero un PDF temporal y reemplaza el anterior al terminar; si falla la construcción, el PDF anterior se conserva.

## Arquitectura y comprobaciones

`report_catalog.py` selecciona, titula y ordena las láminas. `reports.py` organiza contenido, interpretación, tablas, imágenes paginadas, navegación y caché del informe. El comando reutiliza el mismo generador. Las rutas de descarga conservan su contrato y privacidad.

Las pruebas cubren selección completa de PNG, exclusión de duplicados raster, orden temporal, imágenes largas sin filas omitidas, actualización de informes antiguos, invalidación de caché, exportación si falta el artefacto PDF, privacidad y conservación del PDF anterior si falla la construcción. El recorrido de navegador comprueba las descargas y la estabilidad del visor.

El estudio 23 se revisó como ejemplo: dos fechas, un intervalo y **17 PNG independientes en 25 páginas**, con las láminas generales divididas para mantener su legibilidad. Se revisaron las páginas renderizadas, los textos extraídos, el índice y los marcadores.

Verificación del rediseño del 27 de octubre de 2026: **67 pruebas en la suite completa aprobadas**, sin omisiones, con PostgreSQL, navegador y el par Sentinel-2 real incluido v9. Tras añadir el caso de exportación sin artefacto PDF previo y ajustar la caché, **6 comprobaciones específicas de informes/pipeline aprobadas**; comprobación final del módulo: **5 aprobadas**. Las 12 pruebas del frontend, lint, compilación, Ruff, comprobaciones de Django y validación de Swagger pasaron. No se requieren migraciones. El PDF descargable del estudio 23 quedó actualizado, con una copia del anterior conservada fuera de Git.

Mantenimiento: al cambiar la plantilla o su interpretación debe incrementarse `REPORT_VERSION` en `reports.py`, para invalidar los PDF almacenados. La huella también cambia si se actualizan resumen, nombre, descripción, área o láminas del estudio.
