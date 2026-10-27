# Mapas interactivos de resultados

## Uso desde la web

En un análisis completado, **Imagen original y resultado** permite explorar cada fecha o comparación sin volver a procesar las imágenes:

1. Seleccionar **Fecha o comparación**.
2. Pulsar una o varias tarjetas de cobertura para resaltar sus zonas. Volver a pulsar una tarjeta la deselecciona; sin selecciones se muestran todas.
3. Ajustar **Visibilidad del resto**: 0 % oculta las categorías no seleccionadas; el valor inicial de 20 % conserva su contexto atenuado.
4. Pulsar **Ver más detalles** para abrir **¿Qué quieres observar?** y elegir el resumen de cobertura o un indicador: vigor y cobertura vegetal (NDVI, B8/B4), humedad (NDMI, B8/B11), condición de cobertura y señales de degradación (NBR, B8/B12), o clorofila y vigor (NDRE, B8/B5). El selector empieza oculto; la barra **Visibilidad del resto** permanece visible. Ocultar detalles conserva la capa y las selecciones; el nombre del indicador activo sigue visible.
5. **Mostrar todo** restablece categorías, selección y visibilidad. Cambiar de fecha o intervalo también restablece la exploración para ese periodo.
6. **Descargar vista PNG** exporta el mapa tal como se está viendo, con sus transparencias. Es una imagen de visualización, sin georreferenciación ni lámina de métricas. Las descargas originales de PNG, GeoTIFF, PDF y ZIP siguen disponibles y contienen los resultados completos.

El original permanece como referencia. Los porcentajes y hectáreas siempre proceden del resumen original, con el mismo denominador de área válida; seleccionar categorías no modifica esos valores ni envía otro trabajo al worker. Los estados de selección tienen texto y `aria-pressed`, funcionan con teclado y no dependen únicamente del color. Los controles se distribuyen en una sola columna en pantallas pequeñas.

El botón **Ver más detalles** tiene iconos de ajustes e información y una flecha que indica su estado. Al pasar el cursor por el botón (incluido el icono) o enfocarlo con el teclado se muestra una ayuda breve sobre los índices disponibles. La ayuda se puede recorrer con el cursor, se cierra con Escape y al activar el botón; Enter o Espacio abre/cierra los controles. La barra de visibilidad sigue siempre visible.

La indicación **Resalta zonas en el mapa** introduce las tarjetas seleccionables. Cada tarjeta disponible muestra una casilla y **Resaltar en el mapa**; al seleccionarla aparecen la marca, el contorno activo y **Quitar resaltado**. Toda la tarjeta es un único botón, sin controles anidados. Las categorías no disponibles permanecen deshabilitadas. Los cambios de estado usan texto, marca y color, y las transiciones respetan la preferencia de movimiento reducido.

Una fecha muestra condición de vegetación y no permite seleccionar degradación sin otra fecha. Una categoría con cero píxeles se puede seleccionar: se informa que no está presente. Las comparaciones muestran categorías temporales y diferencias de índices **final menos inicial**. Los índices conservan su escala técnica, distinta de los porcentajes de superficie.

Las leyendas principales usan descripciones como **Menor humedad / Mayor humedad** o **Disminuye el vigor / Sin cambio / Aumenta el vigor**. Se eliminó el párrafo técnico permanente bajo la leyenda. **Ver escala numérica**, cerrado inicialmente, permite consultar los valores originales cuando se necesiten. Las superficies y la cobertura válida se presentan en porcentaje; los índices no se multiplican por 100 ni se presentan como porcentajes de deforestación. Por ejemplo, una diferencia NDVI de −0,2 no representa 20 % de pérdida de bosque.

El resumen por categorías es la vista que muestra bosque estable, degradación y posible deforestación. Las capas de cada índice ayudan a interpretar esas señales; sus nombres descriptivos no añaden otra clasificación ni cambian los criterios del análisis.

La mejora de nombres y leyendas se verificó con las ocho pruebas del cliente/composición, lint, compilación y el recorrido completo de navegador. Este último comprueba los textos de cada indicador en una fecha y en comparaciones, la apertura y cierre de la escala numérica, la selección, descarga y distribución móvil. No se modifican los valores del backend ni las reglas de clasificación.

## Datos y API

Los artefactos `condicion_bosque.tif` incluyen `category_mask_url`. La interfaz sigue este enlace privado automáticamente, sin pedir un ID al usuario.

`GET /api/v1/artifacts/{artifact_id}/category-mask/` devuelve:

```json
{
  "width": 2,
  "height": 2,
  "grid": {
    "width": 2, "height": 2, "crs": "EPSG:32618",
    "transform": [10, 0, 500000, 0, -10, 500000]
  },
  "encoding": "uint8-base64",
  "nodata": 255,
  "values": "AAECAw=="
}
```

Se decodifica un byte por píxel en orden de filas. Valores 0, 1, 2 y 3 son las categorías cuyos nombres, colores y estadísticas se obtienen de `condicion.categorias`; 255 es sin datos. No se deducen clases comparando colores del PNG. Este endpoint solo admite el raster de condición y comprueba permiso `analyses.view_analysis`, propietario y ruta segura. Usa `Cache-Control: private, no-store`.

La máscara usa vecino más cercano, como máximo 768 píxeles en su dimensión mayor, sin crear clases interpoladas. Las vistas PNG de índices usan el mismo límite y conservan su geometría. `grid` describe el raster original: ancho, alto, CRS y seis componentes de su transformación afín. La interfaz comprueba esa geometría y las dimensiones de visualización antes de aplicar la máscara; si no coinciden, informa el error y evita superponer capas desalineadas.

La vista es una muestra para pantalla: detalles más pequeños que un píxel de visualización pueden no aparecer al reducir un raster grande. Las estadísticas y el GeoTIFF completo conservan la resolución del análisis.

`GET /api/v1/artifacts/{artifact_id}/preview/?palette=contrast` y `metadata/?palette=contrast` proporcionan PNG y leyenda coherentes para los índices. `palette` es opcional: omitirlo conserva el comportamiento existente. Otros valores devuelven 400. Las capas interactivas usan las mismas escalas fijas de contraste que las láminas:

| Capa individual | Escala | Bandas |
| --- | --- | --- |
| NDVI | 0,2 a 0,9 | B8, B4 |
| NDMI | −0,2 a 0,6 | B8, B11 |
| NBR | −0,2 a 0,8 | B8, B12 |
| NDRE | 0 a 0,7 | B8, B5 |
| dNDVI, dNDMI, dNBR, dNDRE | −0,2 a +0,2 | Las correspondientes al índice |

Rojo significa valor bajo en una fecha y descenso en una comparación; azul significa valor alto o aumento respectivamente. Los valores que exceden el rango conservan el color del extremo. No se cambian umbrales, clases, modelo ni pipeline.

## Implementación y verificación

- `CoverageResults` organiza periodos, capas y selección; al cambiar de periodo remonta el explorador y limpia selecciones anteriores.
- `InteractiveCoverageMap` solicita máscara y capas mediante el cliente autenticado. Cancela solicitudes al cambiar de capa o abandonar la pantalla y cierra los bitmaps utilizados. La composición se realiza en Canvas; cambiar tarjetas o visibilidad solo repinta, sin solicitudes de análisis ni de raster.
- `mapLayers.js` concentra la composición de píxeles y la comprobación de geometría. Los componentes del visor se cargan de forma diferida.
- Los resultados anteriores que todavía no tengan mapa de condición mantienen su presentación original; no se recalculan ni se alteran automáticamente.

Pruebas específicas: `backend/tests/test_raster_preview.py`, `test_schema.py`, `test_roles.py`; `frontend/tests/mapLayers.test.mjs`; y el flujo Edge → Django → pipeline de `test_frontend_e2e.py` con `FORESTGUARD_BROWSER_TEST=1`. Las escenas controladas contienen regiones conocidas para comprobar colores, selección múltiple, opacidad, transparencias, estadísticas invariables, cuatro índices, descarga y restablecimiento de periodo.

Verificación del 25 de octubre de 2026:

- Suite completa: **53 pruebas aprobadas**, sin omisiones, con navegador y el par Sentinel-2 real 2024-08-07 → 2026-10-13, incluido v9.
- Comprobación adicional del navegador tras ajustar el ancho: **1 aprobada**, con límites del panel dentro de un viewport de 390 px tanto en resultados individuales como comparativos.
- `pnpm test`: **8 aprobadas**, incluidas sesión/cliente HTTP y composición del mapa.
- `pnpm lint`, `pnpm build`, Ruff, `manage.py check` y validación de Swagger: correctos. El visor se divide en módulos diferidos; no añade dependencias ni cambia `pnpm dev`.
- Las pruebas usan una base PostgreSQL temporal y archivos aislados. No se alteraron resultados personales.

Durante el recorrido del asistente de creación se sigue observando una advertencia de React por una actualización de `NewAnalysis` durante el renderizado de `AreaAnalysis`. Esos componentes no se modifican en esta funcionalidad; la advertencia no impidió completar el flujo y queda como revisión independiente. Rasterio también emite advertencias de deprecación de su dependencia Affine, sin fallos de ejecución.

Verificación del ajuste visual del 27 de octubre de 2026: **12 pruebas del frontend y el recorrido completo de navegador aprobados**, lint y compilación correctos. El navegador comprueba ayuda con cursor/foco, permanencia al mover el cursor sobre ella, cierre con Escape, apertura con Enter, selección con Espacio, marca y acción de las tarjetas, selección múltiple, opacidad, descargas y presentación a 390 px. Se revisaron las capturas individuales y comparativas de escritorio y móvil. Se conservan las advertencias preexistentes de Rasterio/Affine y tiempo de plugins de compilación; no hubo fallos.
