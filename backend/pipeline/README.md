# ForestGuard: pipeline histórico portable

Componente de procesamiento para integrar en otro proyecto. No contiene servidor, API ni interfaz web. El modelo v9 es exploratorio y el puntaje no es probabilidad calibrada ni riesgo futuro.

Instala `requirements-pipeline.txt` en un entorno Python compatible (versión de creación: 3.13.7).

Para GeoTIFF de bandas descritas, ejecuta primero `src/normalizar_entrada_forestguard.py --help`; declara la escala y el factor SCL. Para un SAFE L2A extraído con bandas nativas, usa `src/normalizar_safe_l2a_ventanas.py --help`. Para COG locales separados por banda con Item STAC, usa `src/normalizar_stac_cog_ventanas.py --help`. Para escenas ya estandarizadas:

```powershell
python src/forestguard_pipeline.py --escena '2024-05-07=escena_20240507.tif' --escena '2024-08-30=escena_20240830.tif' --modelo model/modelo_exploratorio.joblib --salida salida
```

Con una sola `--escena`, omite `--modelo`: devuelve índices y estadísticas. Con dos o más escenas con máscara SCL, entrega diferencias e indicios espectrales de degradación observada por intervalo; esta regla no confirma degradación forestal y requiere revisión. El modelo clasifica solo los intervalos compatibles. Desde tres fechas calcula también tendencia NDVI. Las salidas son GeoTIFF y `resumen_serie.json`. Las rutas de escenas se proporcionan en tiempo de ejecución; los archivos fuente y el modelo no requieren el directorio original.

Para una investigación puntual se puede añadir `--permitir-intervalos-fuera-de-entrenamiento` junto con `--modelo`. Esto ejecuta v9 también en pares separados más de 330 días (o menos de 35), marcando cada resultado afectado con `fuera_intervalo_entrenamiento` y `ejecucion_experimental` en los JSON. Son predicciones fuera del intervalo temporal con que se entrenó el piloto: no están validadas para esas separaciones y no confirman deforestación. El backend no activa esta excepción al procesar análisis normales.

Usa el manifiesto SHA256 para verificar los archivos transferidos. No cargues archivos `joblib` provenientes de terceros no confiables.
