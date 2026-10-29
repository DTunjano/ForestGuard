# Sincronización de dev - 29 de octubre de 2026

## Cambios remotos incorporados

- `fb34950`: rediseño de gestión de usuarios y de ayuda/soporte, filtros y ficha de usuario, validaciones visuales, ruta de preguntas frecuentes y navegación correspondiente.
- `1275eec`: consolidación de la rama remota y documento de grado corregido.

## Integración

Se conservan el diseño nuevo de usuarios, la ayuda y FAQ, y los once commits locales pendientes sobre capas interactivas, administración, roles por ID, resultados por niveles e informes PDF.

El conflicto de `Users.jsx` se resolvió preservando los formularios y estilos nuevos, la creación de administradores y superusuarios autorizados, la selección múltiple de roles por ID, los roles personalizados y las protecciones de cuentas privilegiadas. Los filtros de rol/estado se aplican en el servidor antes de paginar, para que totales y búsqueda no dependan solo de los registros visibles. La guía se ajustó a cobertura mínima del 60 %, separación mínima de 35 días sin máximo y resultados por niveles.

La integración se prepara en `integration/dev-sync-20261029`; `dev` se actualizará y publicará cuando se complete su verificación. No se reescribe el historial compartido.

## Verificación inicial

Aprobados lint, las 12 pruebas del frontend y compilación; Ruff, comprobación de Django, validación de Swagger y tres pruebas sin base de datos (clasificación y esquema). Se añadieron comprobaciones de filtros de usuarios entre páginas, rol personalizado, denegación por permisos y navegación Ayuda/FAQ.

Pendiente la ejecución completa con PostgreSQL y navegador: Docker Desktop no inició por un archivo IPC inaccesible (`dockerInference`). No se modificaron volúmenes ni bases de datos. La publicación queda pendiente de esta comprobación.
