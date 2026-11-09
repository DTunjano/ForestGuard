# Jaccard en ForestGuard

## Coincidencia entre fechas

En **Historial → Resultados → Resumen**, selecciona un intervalo en **Fecha o comparación**. La sección **Coincidencia de vegetación de vigor alto** muestra la superposición (Jaccard), la superficie que salió de la categoría y la que entró. El PDF incluye la lectura en el apartado de cada intervalo. El JSON y la API publican los conteos originales en `intervalos[].coincidencia_vegetacion`.

El pipeline aplica el umbral operativo NDVI ≥ 0,5 a cada escena alineada, dentro de la máscara común válida. Acumula intersección, unión, salida y entrada por ventanas. Una unión vacía se presenta como **No evaluable**. Una imagen individual carece de intervalo. Para obtener la métrica de un análisis anterior se puede crear un nuevo análisis con las mismas escenas.

La coincidencia describe la distribución del vigor alto. Las salidas y entradas se refieren a esa categoría espectral. Jaccard es simétrico y por sí solo no cuantifica hectáreas de pérdida.

## Evaluación automática de v9 con IDEAM

En **Historial → Resultados → Evaluación v9**, el selector carga la evaluación correspondiente a cada predicción. Si existe un resultado guardado se muestra al abrir el intervalo. Si las capas son compatibles, **Evaluar con IDEAM** calcula y guarda el resultado sin pedir archivos al usuario. La referencia propia queda disponible como un flujo separado.

La comparación usa las capas anuales del [catálogo oficial de cambio de bosque](https://bart.ideam.gov.co/smbyc/Cambio%20en%20la%20superficie%20cubierta%20por%20bosque%20natural/Capas/). Se habilita cuando el intervalo tiene al menos un año calendario completo, están instaladas todas las capas de los años que toca el par y la predicción está fuera de las zonas supervisadas registradas de v9. Un par corto requiere una referencia propia fechada para ese intervalo.

Se alinean las categorías a la cuadrícula de la predicción por vecino más cercano. Se conservan pérdidas IDEAM de los años completos y se excluyen los píxeles con pérdida en un año parcial, regeneración, falta de información o falta de predicción. Los negativos permanecen estables según las capas de todos los años. Esto mide concordancia con el monitoreo anual en el área comparable. Las capas anuales son compuestos de imágenes y su resolución original es de aproximadamente 30 m. El resultado tampoco certifica que un sector esté fuera de cualquier revisión exploratoria previa.

La API publica el estado y el resultado en `ideam` dentro de la consulta del artefacto. `POST /api/v1/artifacts/{artifact_id}/v9-evaluation/ideam/` calcula la evaluación sin carga. El propietario conserva un resultado IDEAM y otro de referencia propia para cada predicción.

### Instalación de capas en otra copia

Descarga los archivos `.img` del catálogo oficial con los nombres definidos en `backend/analyses/ideam_reference.py`. Colócalos en `backend/reference_data/ideam/` o configura `IDEAM_REFERENCE_ROOT` para indicar otra carpeta. En esta copia quedaron instaladas las capas cuyo año final es de 2019 a 2025. Se mantienen fuera de Git y no se descargan en cada solicitud.

## Evaluación de v9 con referencia propia

En **Historial → Resultados → Evaluación v9**, selecciona un intervalo con predicción y abre **Evaluación con referencia propia**. Se admiten análisis anteriores que conserven el GeoTIFF de clasificación v9. El botón **Descargar predicción GeoTIFF** permite consultar la cuadrícula de destino.

El archivo descargado sirve como plantilla espacial. Carga un GeoTIFF con etiquetas verificadas de una fuente independiente. ForestGuard rechaza una copia exacta de la predicción, aunque se cambie el nombre del archivo.

1. Prepara las etiquetas de una fuente verificada, independiente del entrenamiento y ajuste, para la misma zona e intervalo. Si la referencia consiste en polígonos, rasterízalos sobre la cuadrícula de la predicción. Codifica como 0 solamente la superficie verificada sin pérdida.
2. Guarda un GeoTIFF de una banda Byte (UInt8) con el mismo CRS, dimensiones y transformación afín que la predicción. Etiquetas: 0 sin pérdida, 1 pérdida y 255 sin etiqueta. Si se declara NoData, debe ser 255. Se admiten hasta 64 MB y 25 millones de píxeles.
3. Selecciona el archivo, indica su fuente y confirma la independencia. Pulsa **Calcular y guardar evaluación**. El resultado muestra Jaccard, precisión, sensibilidad, la matriz de conteos y la proporción de la predicción que se pudo evaluar.

La API guarda la última evaluación manual válida por predicción, junto con el nombre de la referencia, su fuente y la fecha. El GeoTIFF de referencia se usa durante la solicitud. Una actualización válida reemplaza el resultado manual anterior. El propietario puede consultarlo al reabrir la pantalla. La evaluación pertenece a ese intervalo y a la zona etiquetada.

`GET /api/v1/artifacts/{artifact_id}/v9-evaluation/` consulta la evaluación. `POST` recibe `reference`, `reference_source` e `independent_reference=true` como multipart. La URL también se entrega en el artefacto de clasificación como `v9_evaluation_url`. La consulta requiere permiso de lectura del análisis. La carga requiere además permiso para crear análisis.

Los píxeles sin etiqueta o sin predicción se excluyen. Si la referencia carece de píxeles comparables, se rechaza. Si ambas máscaras carecen de positivos en el área evaluada, Jaccard queda indeterminado. La precisión y la sensibilidad también quedan indeterminadas cuando sus denominadores son cero.

## Operación

Con PostgreSQL en ejecución, aplica la migración de evaluaciones desde `backend`:

```powershell
.\.venv\Scripts\python.exe manage.py migrate
```

La verificación automatizada cubre la coincidencia en un análisis con GeoTIFF de prueba, el cálculo de la matriz de confusión, la protección por propietario, la conservación del resultado ante archivos inválidos y el formulario de resultados en navegador. Para recomendar v9 en un uso operativo hace falta evaluar varios intervalos y territorios con referencias representativas e independientes.
