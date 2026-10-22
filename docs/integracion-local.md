# Integración local por funcionalidades

## Base y fases

Base: `dev` y `origin/dev`, d05e36b, sin cambios locales. Rama acumulativa
`integration/frontend-backend`. Cada rama de fase nace del último avance de
integración y se incorpora localmente por fast-forward. No se publica ni se
modifica dev/main.

1. `feature/integration-auth`: cliente HTTP, sesión y rutas.
2. Gestión: perfil, usuarios, modelos, áreas y carga.
3. Análisis: creación, seguimiento, historial, resultados y exportaciones.
4. Verificación y documentación.

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

El proxy local de Vite dirige `/api` a 127.0.0.1:8000. VITE_API_URL es pública
y no debe contener secretos. Las URLs de archivos de Django se normalizan a
la base configurada antes de adjuntar Authorization. La autorización efectiva
y la propiedad de datos siguen verificándose en Django.
