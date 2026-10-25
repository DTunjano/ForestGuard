# ForestGuard: pipeline histórico portable

Componente de procesamiento para integrar en otro proyecto. No contiene servidor, API ni interfaz web. El modelo v9 es exploratorio y el puntaje no es probabilidad calibrada ni riesgo futuro.

Instala `requirements-pipeline.txt` en un entorno Python compatible (versión de creación: 3.13.7).

Para GeoTIFF de bandas descritas, ejecuta primero `src/normalizar_entrada_forestguard.py --help`; declara la escala y el factor SCL. Para un SAFE L2A extraído con bandas nativas, usa `src/normalizar_safe_l2a_ventanas.py --help`. Para COG locales separados por banda con Item STAC, usa `src/normalizar_stac_cog_ventanas.py --help`. Para escenas ya estandarizadas:

```powershell
python src/forestguard_pipeline.py --escena '2024-05-07=escena_20240507.tif' --escena '2024-08-30=escena_20240830.tif' --modelo model/modelo_exploratorio.joblib --salida salida
```

Con una sola `--escena`, omite `--modelo`: devuelve índices y estadísticas. Con dos o más escenas con máscara SCL, entrega diferencias e indicios espectrales de degradación observada por intervalo; esta regla no confirma degradación forestal y requiere revisión. El modelo clasifica solo los intervalos compatibles. Desde tres fechas calcula también tendencia NDVI. Las salidas son GeoTIFF y `resumen_serie.json`. Las rutas de escenas se proporcionan en tiempo de ejecución; los archivos fuente y el modelo no requieren el directorio original.

La política de ejecución requiere **al menos 35 días entre fechas consecutivas y no tiene máximo**.
No es necesario activar una excepción para pares de más de 330 días. Los flags anteriores se
conservan por compatibilidad y no permiten pares de menos de 35 días. Los metadatos
`intervalo_entrenamiento_dias`, `fuera_intervalo_entrenamiento` y `ejecucion_experimental`
conservan el contexto del modelo entrenado; el archivo del modelo no se altera.

Antes de generar índices o inferencias se verifica que cada escena y el área común
comparable tengan **al menos 60 % de cobertura válida**. Se usan lecturas por ventanas,
con la misma máscara de bandas válidas y denominadores de índices que la API.
Los archivos cargados al backend se validan también durante la carga, antes de guardar.
Consulta [la guía de calidad y comparaciones](../../docs/calidad-y-comparaciones.md).

Usa el manifiesto SHA256 para verificar los archivos transferidos. No cargues archivos `joblib` provenientes de terceros no confiables.

El manifiesto normaliza CRLF a LF antes de calcular los SHA256 de `.py` y `.json`,
para que la comprobación funcione con los finales de línea de Windows y Linux.
Los binarios se verifican byte por byte. Se mantienen el modelo y su contrato de
entrenamiento originales; `politica_ejecucion` documenta los límites de ejecución actuales.
