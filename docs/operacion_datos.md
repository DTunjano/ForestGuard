# Operación de datos locales

## Copia íntegra

ForestGuard guarda relaciones y estados en PostgreSQL, y archivos originales y resultados en `backend/media/`. Ambos componentes son necesarios para recuperar un análisis. `backup_forestguard` usa `pg_dump` en el contenedor `db` y copia `MEDIA_ROOT` a un directorio nuevo con sumas SHA-256. El comando se niega a comenzar si hay análisis `running`.

1. Detenga `runserver` y `run_analysis_worker` para que no cambien la base ni los archivos durante la copia. Mantenga `docker compose up -d --wait db` activo.
2. Desde `backend/`, active `.venv` y ejecute `py manage.py backup_forestguard --destination ../backups`.
3. Ejecute `py manage.py verify_forestguard_backup --backup-dir RUTA_DE_LA_COPIA` y conserve una segunda copia en otra unidad con acceso restringido. Los GeoTIFF y la base contienen datos de usuarios; no suba `backups/` al repositorio.

El manifiesto verifica integridad accidental, no autenticidad criptográfica. La copia no bloquea nuevas escrituras de la API; por ello es obligatorio detener la API y el worker durante su creación. Una copia correcta debe probarse también con una restauración aislada, especialmente después de cambios de versión de PostgreSQL.

## Restauración de prueba

Use una instalación aislada y vacía con la misma versión de código, PostgreSQL y variables de base de datos. Detenga su API y worker. Compruebe el manifiesto, copie `database.dump` al contenedor `db` con `docker compose cp` y restáurelo allí con `pg_restore --no-owner --no-acl -U USUARIO -d BASE /tmp/database.dump`. Copie el contenido de `media/` de la copia a `backend/media/` de esa instalación. Ejecute `py manage.py migrate --check` y consulte una imagen y un resultado desde la API. No ejecute `pg_restore` sobre la base de desarrollo existente: reemplazaría datos actuales. La restauración real debe ensayarse primero en la instalación aislada.

## Retención

No hay borrado automático por edad. `prune_analysis_data --older-than-days N` solo enumera cuántos análisis terminados cumplen el umbral. `--include-unused-uploads` añade imágenes antiguas que no quedarán referenciadas por análisis después de la limpieza. Antes de usar `--execute`, detenga API y worker. La ejecución exige una copia verificada y creada hace menos de 24 horas. La operación es irreversible en la instalación activa y no se ejecuta al iniciar Django ni el worker.

Los trabajos en cola o en ejecución no son candidatos. Los archivos normalizados de un análisis se eliminan junto con sus resultados cuando se purga ese análisis. Los GeoTIFF originales ligados a otros análisis se conservan. Conserve las copias durante el plazo acordado antes de depurarlas manualmente.

## Recuperación de trabajos

Al reclamar un análisis, el worker registra `heartbeat_at`; durante el procesamiento lo renueva cada 30 segundos. Si un worker termina abruptamente, el siguiente ciclo de espera de un worker en funcionamiento detecta latidos vencidos por más de 15 minutos y marca esos análisis como `failed`. Así evita dejar trabajos indefinidamente en `running` sin asumir que una ejecución parcial puede reanudarse. Los archivos parciales no se borran automáticamente; revise el error y solicite un análisis nuevo si procede.
