# Mapas interactivos de resultados

## Uso desde la web

En un análisis completado, **Imagen original y resultado** permite explorar cada fecha o comparación sin volver a procesar las imágenes:

1. Seleccionar **Fecha o comparación**.
2. Pulsar una o varias tarjetas de cobertura para resaltar sus zonas. Volver a pulsar una tarjeta la deselecciona; sin selecciones se muestran todas.
3. Ajustar **Visibilidad del resto**: 0 % oculta las categorías no seleccionadas; el valor inicial de 20 % conserva su contexto atenuado.
4. Cambiar **Capa del mapa** entre categorías, NDVI, NDMI, NBR y NDRE. La selección de categorías se conserva y permite observar el índice únicamente en esas zonas. Cada índice identifica sus bandas y tiene una escala visible.
5. **Mostrar todo** restablece categorías, selección y visibilidad. Cambiar de fecha o intervalo también restablece la exploración para ese periodo.
6. **Descargar vista PNG** exporta el mapa tal como se está viendo, con sus transparencias. Es una imagen de visualización, sin georreferenciación ni lámina de métricas. Las descargas originales de PNG, GeoTIFF, PDF y ZIP siguen disponibles y contienen los resultados completos.

El original permanece como referencia. Los porcentajes y hectáreas siempre proceden del resumen original, con el mismo denominador de área válida; seleccionar categorías no modifica esos valores ni envía otro trabajo al worker. Los estados de selección tienen texto y `aria-pressed`, funcionan con teclado y no dependen únicamente del color. Los controles se distribuyen en una sola columna en pantallas pequeñas.

Una fecha muestra condición de vegetación y no permite seleccionar degradación sin otra fecha. Una categoría con cero píxeles se puede seleccionar: se informa que no está presente. Las comparaciones muestran categorías temporales y diferencias de índices **final menos inicial**. Los índices conservan su escala técnica, distinta de los porcentajes de superficie.

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
