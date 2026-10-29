# Selección de archivos, cobertura y comparación temporal

Actualización del 24 de octubre de 2026. Pipeline: `forestguard_historico_v4`.

## Selector de archivos

El selector y la cola usan la misma lista de archivos en React. El encabezado
muestra cantidad y nombres; quitar un archivo o limpiar la cola actualiza ambos
lugares. El control de archivo nativo se mantiene oculto y se vacía para poder
volver a elegir un mismo archivo, sin mostrar un estado contradictorio.

## Cobertura mínima de 60 %

- Se mide en el servidor durante la carga, antes de guardar el archivo o sus
  metadatos. Si no llega a 60 %, la API devuelve `400` con porcentaje, conteo y
  motivo. **60 % exacto sí se acepta**.
- El cálculo lee ventanas de hasta 512 × 512 píxeles; no calcula índices ni
  ejecuta el modelo. Para obtener un porcentaje exacto es necesario leer la
  máscara de calidad de toda la escena.
- Píxeles válidos: todas las bandas requeridas con datos, reflectancia en [0,1],
  denominadores definidos de NDVI/NDMI/NBR/NDRE y, cuando existe SCL, clases 4/5
  válidas tras aplicar el factor detectado. La regla de máscara existente se
  conserva.
- Las respuestas de imágenes añaden `valid_pixel_count`,
  `valid_coverage_percent` y `quality_check_version`, de solo lectura. La web
  muestra la cobertura al terminar la carga y en la ficha técnica.
- Para imágenes antiguas, el servidor comprueba la cobertura al crear un análisis;
  si no cumplen, no encola el trabajo. Guarda el resultado de esa comprobación
  para futuras consultas. El worker vuelve a verificar los archivos antes de
  crear copias normalizadas o invocar procesos del pipeline.
- En comparaciones, el pipeline también exige al menos 60 % de cobertura **común**
  sobre la cuadrícula inicial. Este chequeo se hace tras la alineación necesaria
  y antes de generar índices, inferencias o resultados. Si falla, el análisis
  queda `failed` con el motivo; no se genera una carpeta de resultados parcial.

La migración `catalog.0002_image_quality` añade campos anulables a imágenes
existentes. No inventa porcentajes para archivos antiguos ni ejecuta análisis
durante la migración.

## Política temporal: mínimo 35 días, sin máximo

API, asistente web y CLI aceptan comparaciones con intervalos consecutivos de
**35 días o más**, tanto descriptivas como con v9. Los intervalos de 34 días o
menos se rechazan antes de procesar; las imágenes se pueden analizar individualmente.

Las tres entradas del pipeline están actualizadas:

- `src/forestguard_pipeline.py`
- `src/inferir_par_ideam.py`
- `src/inferir_par_ideam_ventanas.py`

No se necesita activar una excepción para 331, 550, 797 días o más. Los flags
antiguos `--permitir-intervalos-fuera-de-entrenamiento` y
`--permitir-intervalo-fuera-de-entrenamiento` se conservan por compatibilidad y
no permiten saltarse el mínimo de 35 días.

`politica_temporal` indica `{"minimo_dias":35,"maximo_dias":null}`. El intervalo
35–330 permanece en los metadatos del **entrenamiento** del modelo, junto con
`fuera_intervalo_entrenamiento` y `ejecucion_experimental` para conservar el
contexto de cada inferencia. Ese dato no bloquea la ejecución. No se modifican
el archivo entrenado `.joblib`, sus predictores ni su umbral de clasificación.
Esta actualización verifica funcionamiento; no vuelve a estimar la exactitud
del modelo para nuevos intervalos.

Se conservan los demás requisitos de entrada del modelo: SCL, bandas y escala
compatibles, CRS en metros, cuadrícula y resolución admitidas. No se interpreta
una incompatibilidad de entrada como ausencia de cambios.

## PDF

Se elimina por completo la sección **Método y trazabilidad**, incluidas sus
referencias finales. Se conservan mapas, porcentajes, interpretación, cobertura
y estadísticas. La información técnica de ejecución sigue disponible en JSON.

Los análisis anteriores conservan los resultados con que fueron generados.
Para obtener el PDF actualizado y ejecutar v9 donde antes se omitía por exceder
330 días, cree un análisis nuevo con las imágenes existentes. No se reprocesa
automáticamente el historial.

## Aplicación local y comprobaciones

En `backend`, con `.venv` activo:

```powershell
py manage.py migrate
py manage.py runserver
# Otra consola, con el mismo entorno activo:
py manage.py run_analysis_worker
```

En `frontend`: `pnpm dev`. Reinicie el worker tras actualizar y recargue la web.

Pruebas incorporadas: aceptación de 60 % exacto, rechazo de 59 %, imágenes
antiguas, trabajo en cola sin ejecución pesada, cobertura común insuficiente,
v9 a 797 días, límites 34/35/330/331 y comandos CLI sin bypass del mínimo.
La prueba de navegador comprueba además nombres y cantidades en selector/cola,
el porcentaje devuelto y el rechazo de una escena con nubes durante la carga.

## Comprobación de esta actualización

- **51 pruebas aprobadas**, con navegador y pipeline real incluidos.
- El par real **2024-08-07 → 2026-10-13 (797 días)** ejecutó v9 correctamente.
  Se seleccionaron las escenas que comparten ubicación: hay otras escenas de
  2024-08-07 de zonas distintas y no deben combinarse solo por coincidir la fecha.
- Selector/cola, rechazo de 59 %, aceptación de 60 %, imágenes antiguas,
  cobertura común y mínimo de días comprobados.
- 4 pruebas del cliente HTTP, lint y build del frontend correctos.
- Django, migraciones, OpenAPI con `--validate --fail-on-warn` y Ruff correctos.
- PDF individual y comparativo renderizados y revisados sin la sección retirada.
- Migración local aplicada. El modelo entrenado conserva su SHA256; el manifiesto
  incluye las fuentes y la nueva política de ejecución.

Rama local: `feature/upload-quality-and-temporal-policy`, basada en
`feature/results-classification-and-roles` (`9404f79`).
