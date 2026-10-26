# Administración de cuentas y modelos

## Crear un administrador desde Swagger

1. Abrir `/api/docs/` e iniciar sesión en `POST /api/v1/auth/token/` con una cuenta administradora.
2. Copiar el token `access` en **Authorize**.
3. En **Administración de usuarios**, ejecutar `POST /api/v1/admin/administrators/`:

```json
{
  "username": "nuevo_admin",
  "email": "admin@example.com",
  "first_name": "Ana",
  "last_name": "Pérez",
  "password": "UnaContraseñaSegura123!",
  "account_type": "administrator"
}
```

`first_name`, `last_name` y `account_type` son opcionales. El tipo predeterminado es `administrator`. La respuesta `201` incluye ID, roles, permisos efectivos, estado y banderas de Django de solo lectura. La contraseña se valida y guarda con hash; no se devuelve. No hay que escribir IDs de roles ni seleccionar permisos individualmente: el servidor asigna `admin` con todos los permisos del proyecto, incluida la gestión de usuarios, roles y modelos.

El endpoint requiere una cuenta administradora activa con `accounts.add_user` y `auth.change_group`. Anónimos reciben `401`, cuentas sin autorización `403` y datos inválidos o duplicados `400`. Un administrador de aplicación no recibe automáticamente acceso al panel Django `/admin/`. Los recursos privados siguen sujetos al propietario en la API.

### Superusuario de Django

Para crear un superusuario por API, enviar el mismo cuerpo con `"account_type": "superuser"`. **Solo un superusuario existente puede realizar esa operación**. El servidor asigna `is_active=true`, `is_staff=true`, `is_superuser=true` y el rol administrador.

Si todavía no hay una cuenta privilegiada, crear la primera desde consola, con PostgreSQL disponible:

```powershell
Set-Location C:\Users\braya\OneDrive\Desktop\forestGuard_web\ForestGuard\backend
.\.venv\Scripts\Activate.ps1
py manage.py createsuperuser
```

El comando solicita las credenciales de forma interactiva; no poner contraseñas en scripts ni argumentos de consola. Después puede iniciarse sesión en Swagger y utilizar el nuevo endpoint. No existe registro público de administradores, clave compartida de instalación ni creación automática de cuentas en producción.

### Gestión desde la web

En **Administración → Usuarios**, **Crear administrador** abre el formulario con confirmación de contraseña. El selector de superusuario solo aparece al autenticarse como superusuario. La lista identifica estas cuentas y bloquea su edición para administradores de aplicación. El formulario habitual **Nuevo usuario** y la asignación de roles existentes se conservan.

`is_staff` e `is_superuser` no se pueden modificar desde el perfil ni desde los endpoints genéricos de usuarios. No se permite desactivar la propia cuenta, eliminar el propio rol administrador ni dejar al sistema sin un administrador o superusuario activo. Un superusuario debe conservar el rol administrador; modificar una cuenta superusuaria requiere otro superusuario o la propia cuenta, con esas protecciones.

## Gestión de modelos

La consulta del catálogo activo continúa en `GET /api/v1/models/`. La administración está separada:

| Operación | Endpoint | Permiso |
| --- | --- | --- |
| Listar modelos activos e inactivos | `GET /api/v1/admin/models/` | `catalog.view_pipelinemodel` y capacidad de administración de modelos |
| Consultar registro | `GET /api/v1/admin/models/{id}/` | Igual que el listado |
| Consultar paquetes instalados | `GET /api/v1/admin/models/packages/` | Igual que el listado |
| Registrar paquete | `POST /api/v1/admin/models/` | `catalog.add_pipelinemodel` |
| Editar nombre, descripción o disponibilidad | `PATCH /api/v1/admin/models/{id}/` | `catalog.change_pipelinemodel` |
| Eliminar registro sin análisis asociados | `DELETE /api/v1/admin/models/{id}/` | `catalog.delete_pipelinemodel` |

La capacidad de administración para lectura exige ser administrador de proyecto o tener alguno de los permisos de creación, modificación o eliminación de modelos. Un rol personalizado puede gestionar modelos sin obtener acceso a usuarios o roles. Los analistas siguen consultando el catálogo activo y no pueden acceder a esta administración.

Registro de ejemplo:

```json
{
  "package_key": "v9",
  "name": "ForestGuard cambio histórico",
  "description": "Clasificador de cambios de cobertura",
  "active": true
}
```

El servidor admite actualmente el paquete `v9` instalado en `PIPELINE_ROOT`. Comprueba la existencia e integridad SHA-256 del archivo de modelo y su perfil frente a `manifiesto.json`, respetando la normalización LF indicada para JSON. No deserializa el modelo durante el registro. No acepta archivos, rutas, algoritmos, versiones ni métricas suministrados por el cliente. Para incorporar otras versiones, un responsable debe instalar y verificar el paquete en el servidor y ampliar el registro confiable `catalog/model_registry.py`.

Una versión solo se registra una vez; si ya existe, editarla en lugar de duplicarla. Versión, algoritmo y métricas son de solo lectura. El endpoint de paquetes informa `available`, `registered_id` y un mensaje si requiere revisión. El listado permite `search`, `ordering`, `active=true|false` y paginación. Cada registro incluye `analysis_count`.

Para desactivar:

```json
{"active": false}
```

El modelo desaparece de las opciones para nuevos análisis. Los trabajos en cola o ejecución conservan su referencia, y sus resultados no se borran. Al reactivar se verifica de nuevo el paquete. Si el registro tiene análisis asociados, su eliminación devuelve `400`; se ofrece desactivarlo. El borrado de un registro sin uso conserva los archivos instalados.

En **Administración → Gestión de modelos** se ofrecen búsqueda, filtro por disponibilidad, registro, edición y confirmación de eliminación. Los controles respetan los permisos del usuario, y la API vuelve a comprobarlos. **Ver catálogo de modelos** conserva la presentación existente para consulta. Se reutilizan `Page`, `Panel`, `Field`, `Select`, `Modal` y la confirmación accesible de eliminación.

## Arquitectura y ejecución

- Cuentas: `accounts` conserva serializers, vistas y permisos del dominio. La creación privilegiada se realiza en una transacción.
- Modelos: `catalog` concentra registro confiable, validación y administración. La API pública de consulta permanece compatible.
- Frontend: formularios y llamadas a API se mantienen en `features/users` y `features/models`; rutas y capacidades compartidas están en `app`.
- El catálogo de roles ofrece ahora **21 permisos** de operaciones soportadas. El rol base administrador ya disponía de los permisos estándar de Django; no requiere migración de esquema ni reasignar cuentas existentes.
- Se mantienen `pnpm dev`, el backend y worker mediante consola y PostgreSQL en Docker. No se realizan despliegues ni se amplía el alcance científico del pipeline.

Las pruebas específicas están en `backend/tests/test_admin_management.py`. Comprueban creación, validaciones, permisos, protección de superusuarios, registro público sin elevación, integridad del paquete, activación, eliminación protegida y contrato Swagger. El recorrido de navegador registra y administra un modelo, crea cuentas administradoras y superusuarias, verifica sus accesos y después completa los flujos anteriores de carga, análisis y resultados con datos aislados.

## Verificación de esta entrega

- **59 pruebas aprobadas, sin omisiones**, con PostgreSQL temporal, navegador Edge y el par real Sentinel-2 2024-08-07 → 2026-10-13, incluido v9.
- **8 pruebas del frontend aprobadas**; lint y compilación correctos.
- Ruff, comprobación de Django, migraciones y generación/validación de Swagger correctos; no se necesitan nuevas migraciones.
- La prueba concurrente intenta retirar a la vez el rol de los dos administradores: una petición se rechaza y se conserva una cuenta administradora activa. La API bloquea el grupo administrador antes de consultar los miembros y modificar sus cuentas.
- Verificación visual de formularios y administración en escritorio y a 390 px; confirmaciones, estados deshabilitados, error de contraseña y operaciones protegidas comprobados.
- Se conservaron cuentas, modelos y resultados personales. No se generaron credenciales de producción ni se desplegó la aplicación.

Rasterio mantiene advertencias de deprecación de Affine sin fallos de ejecución. El recorrido del asistente de análisis también conserva la advertencia de React ya documentada en [mapas interactivos](mapas-interactivos.md); esos componentes no se modificaron en esta entrega y el flujo completo finalizó correctamente.
