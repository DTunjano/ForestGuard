# Integración local por funcionalidades

## Base y fases

Base: `dev` y `origin/dev`, d05e36b, sin cambios locales. Rama acumulativa
`integration/frontend-backend`. Cada rama de fase nace del último avance de
integración y se incorpora localmente por fast-forward. No se publica ni se
modifica dev/main.

1. `feature/integration-auth`: cliente HTTP, sesión y rutas.
2. `feature/integration-management`: perfil, usuarios, modelos, áreas y carga.
3. `feature/integration-analysis-flow`: seguimiento, historial, resultados y exportaciones.
4. `test/integration-end-to-end`: verificación de navegador y documentación.

Base verificada: backend 24 passed / 1 skipped (raster real opcional). Frontend
build correcto; lint tenía dos errores en AuthContext y NewAnalysis simulados.

## Arquitectura y estado

`app` configura proveedores y navegación; `features` agrupa APIs, hooks y páginas
por dominio; `shared` contiene HTTP y controles comunes. Se conserva el layout
visual existente. Formularios y selecciones son estado local; sesión compartida
en contexto; las consultas mantienen una única respuesta por vista. No se añade
un gestor global ni una biblioteca de caché: en esta fase no hay consultas que
necesiten caché compartida. Las mutaciones revalidan la consulta afectada.

## Sesión

Access JWT solo en memoria. Refresh JWT en sessionStorage de la pestaña para
recuperar sesión al recargar; nunca localStorage. La rotación es single-flight.
Logout revoca el refresh y limpia el estado incluso si hay un fallo de red.
Un fallo de revocación de red puede dejar el token remoto válido hasta caducar.
Las pestañas no comparten una sesión sincronizada; una pestaña duplicada que
copie un refresh puede requerir un nuevo login tras la rotación en la original.
sessionStorage sigue siendo accesible a JavaScript: XSS podría extraer el token.
No usar HTML arbitrario ni registrar credenciales. Antes de desplegar, evaluar
refresh en cookie HttpOnly Secure con CSRF y política de orígenes apropiadas.
Esta decisión mantiene el contrato JWT de Swagger y clientes actuales.

## Pruebas de navegador

Se añade Playwright como dependencia de desarrollo para verificar formularios,
navegación, sesión y descargas contra Django y el pipeline reales en una base de
pruebas separada. No se incluye en el bundle de la aplicación. Se utiliza Edge
headless instalado en Windows; no necesita un nuevo navegador para esta máquina.
Los GeoTIFF de prueba son sintéticos y no representan evidencia científica.

La API admite además `GET images/?study_area=<id>`: filtro exacto combinado con
paginación y aislamiento por propietario. Los clientes anteriores mantienen su
comportamiento al omitirlo. La interfaz no descarga todo el catálogo de imágenes
para filtrar en el navegador.

El proxy local de Vite dirige `/api` a 127.0.0.1:8000. VITE_API_URL es pública
y no debe contener secretos. Las URLs de archivos de Django se normalizan a
la base configurada antes de adjuntar Authorization. La autorización efectiva
y la propiedad de datos siguen verificándose en Django.

## Inicio en esta máquina

PostgreSQL (Docker Desktop abierto), desde la raíz del repositorio:

```powershell
cd C:\Users\braya\OneDrive\Desktop\forestGuard_web\ForestGuard
docker compose up -d --wait db
```

Consola 1, API:

```powershell
cd C:\Users\braya\OneDrive\Desktop\forestGuard_web\ForestGuard\backend
.\.venv\Scripts\Activate.ps1
py manage.py runserver
```

Consola 2, worker:

```powershell
cd C:\Users\braya\OneDrive\Desktop\forestGuard_web\ForestGuard\backend
.\.venv\Scripts\Activate.ps1
py manage.py run_analysis_worker
```

Consola 3, frontend:

```powershell
cd C:\Users\braya\OneDrive\Desktop\forestGuard_web\ForestGuard\frontend
pnpm install --frozen-lockfile
pnpm dev
```

Abra la URL que imprime Vite. Registre una cuenta o ingrese con la existente.
En Nuevo análisis cree/seleccione un área, cargue los archivos, seleccione las
fechas y cree el trabajo. El historial permite recuperarlo después de cerrar
la vista. Abra el resultado y descargue el ZIP completo o archivos individuales.

No se requieren migraciones nuevas para esta integración. `py` responde con
Python 3.13.7 al activar este entorno; fuera de él el launcher de esta máquina
puede indicar que no encuentra Python. Alternativa equivalente dentro de backend:
`.\.venv\Scripts\python.exe manage.py runserver`.

## Repetir las pruebas

Frontend:

```powershell
pnpm lint
pnpm test
pnpm build
```

Backend, con PostgreSQL activo y el entorno virtual:

```powershell
py -m pytest -q --tb=short --disable-warnings
# Incluye navegador y pipeline real sobre escenas sintéticas:
$env:FORESTGUARD_BROWSER_TEST = "1"
py -m pytest -q --tb=short --disable-warnings
Remove-Item Env:FORESTGUARD_BROWSER_TEST
```

La prueba de navegador necesita Node, dependencias pnpm y Microsoft Edge.
Levanta Vite en 127.0.0.1:5187 (debe estar libre), Django en un puerto temporal
y un worker en la base PostgreSQL de pruebas. Guarda capturas locales ignoradas
en frontend/test-results. No ejecute dos suites Django en paralelo sobre la
misma base de pruebas. No cambie ramas ni edite el frontend durante el recorrido,
porque HMR puede reiniciar la sesión o desmontar controles.

Se verifican registro, login, refresh al recargar, logout, roles, edición de
perfil, cambio de contraseña, creación/desactivación de usuarios, selección de
área, carga válida/rechazada, análisis individual y comparación v9 reales,
historial, métricas, imágenes autenticadas, PNG/GeoTIFF/PDF/JSON/ZIP y denegación
de resultados ajenos. El fallo del worker se provoca de forma controlada solo
en la prueba para verificar su presentación. No es una evaluación científica.

## Límites y coordinación

- Las imágenes enviadas correctamente permanecen guardadas. Al abandonar la
  carga se detienen los próximos envíos; el que ya llegó al servidor puede
  terminar. Ante una interrupción de red, revise las imágenes antes de reintentar.
  La API aún no ofrece claves de idempotencia para resolver respuestas perdidas.
- Los archivos privados se descargan como blobs: el navegador necesita memoria
  para el ZIP completo. No se validó el rendimiento con escenas de varios GB.
- Áreas y modelos se cargan como catálogos de referencia. Imágenes, historial y
  usuarios permanecen paginados. Si el catálogo de áreas crece sustancialmente,
  conviene sustituir el selector por búsqueda paginada.
- La web no ofrece aún edición/borrado de áreas ni eliminación de imágenes o
  análisis. La API conserva esas operaciones protegidas. No hay borrados al
  abandonar formularios ni limpieza automática de datos.
- Se conservan colores, sidebar y layout; se reemplazaron las pantallas simuladas
  por controles del contrato real. Coordinar cambios visuales con el compañero
  antes de integrar esta rama en dev.
- El riesgo futuro y la validación científica independiente siguen fuera de esta
  fase. Las pruebas de integración no acreditan que v9 detecte deforestación.

## Commits de implementación

| Rama de fase (base) | Commit | Resultado |
| --- | --- | --- |
| feature/integration-auth (d05e36b) | 56c0b89 | Sesión JWT y rutas privadas |
| feature/integration-management (56c0b89) | f9dd792 | Perfil, usuarios, modelos, áreas y carga |
| feature/integration-analysis-flow (f9dd792) | bbd8afd | Flujo real, métricas, resultados y exportaciones |

La rama de pruebas parte de bbd8afd. Su commit final incorpora pruebas y esta
documentación; consultar `git log integration/frontend-backend`. Las ramas de
fase se conservan para revisión. No se han publicado ni fusionado a dev/main.

## Revisión estática

Frontend: lint y build correctos; cuatro pruebas del cliente HTTP correctas
(normalización de URLs, renovación concurrente, renovación fallida y cierre
durante renovación). Los Python modificados pasan Ruff.

Un chequeo ampliado `ruff check .` desde backend detecta 15 avisos previos de
imports en `catalog/raster_detection.py` y el paquete `pipeline/`, incluido un
import sin uso. Esos archivos no presentan diferencias respecto de dev y no se
modificaron para esta integración. No se afirma que el lint global del pipeline
esté limpio.

## Resultado de la verificación final

- Las 24 pruebas existentes de backend pasaron; se omitió la prueba opcional que
  requiere rutas a escenas reales suministradas externamente.
- El recorrido completo de navegador pasó contra Django, PostgreSQL de pruebas y
  el pipeline, incluidos cambio de contraseña, creación/desactivación de usuarios
  y móvil. La última ejecución dirigida de navegador + filtro de área dio
  **2 passed** (59,99 s).
- Frontend: `pnpm lint`, `pnpm build` y `pnpm test` (4 pruebas) correctos.
- Se revisó visualmente la captura móvil, sin desbordamiento horizontal ni menú
  cubriendo el contenido. El menú se abre por botón y reserva espacio en escritorio.
- Se corrigieron durante las pruebas etiquetas accesibles de selectores, bloqueo
  del formulario durante guardado y superposición del menú. Los resultados
  personales existentes no se utilizaron ni modificaron.
