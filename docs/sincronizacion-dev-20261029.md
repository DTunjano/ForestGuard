# Sincronización de dev - 29 de octubre de 2026

## Cambios remotos incorporados

- `fb34950`: rediseño de gestión de usuarios y de ayuda/soporte, filtros y ficha de usuario, validaciones visuales, ruta de preguntas frecuentes y navegación correspondiente.
- `1275eec`: consolidación de la rama remota y documento de grado corregido.

## Integración

Se conservan el diseño nuevo de usuarios, la ayuda y FAQ, y los once commits locales pendientes sobre capas interactivas, administración, roles por ID, resultados por niveles e informes PDF.

El conflicto de `Users.jsx` se resolvió preservando los formularios y estilos nuevos, la creación de administradores y superusuarios autorizados, la selección múltiple de roles por ID, los roles personalizados y las protecciones de cuentas privilegiadas. Los filtros de rol/estado se aplican en el servidor antes de paginar, para que totales y búsqueda no dependan solo de los registros visibles. La guía se ajustó a cobertura mínima del 60 %, separación mínima de 35 días sin máximo y resultados por niveles.

La integración se preparó en `integration/dev-sync-20261029` y se incorpora a `dev` mediante avance rápido, incluyendo ambos historiales. La publicación utiliza un push normal, sin reescribir el historial compartido.

## Verificación final

Aprobados lint, las 12 pruebas del frontend y compilación; Ruff, comprobación de Django, validación de Swagger y tres pruebas sin base de datos (clasificación y esquema). Se añadieron comprobaciones de filtros de usuarios entre páginas, rol personalizado, denegación por permisos y navegación Ayuda/FAQ.

Docker Desktop mostró inicialmente un error de comunicación y posteriormente PostgreSQL logró iniciar. La conexión se verificó y la suite completa aprobó **69 pruebas, sin omisiones**, con PostgreSQL, navegador, pipeline y el par Sentinel-2 real, incluido v9. Se verificaron los roles personalizados y los filtros, las protecciones de superusuarios y las pantallas nuevas de ayuda y FAQ. No se requieren migraciones; las pruebas usan datos aislados y no cambian resultados personales. Las 46 advertencias de deprecación Rasterio/Affine ya existían y no produjeron fallos. La compilación conserva su aviso informativo sobre tiempo de plugins.

Al guardar un usuario se vuelve a la primera página para evitar páginas vacías si una modificación cambia su pertenencia al filtro activo.
