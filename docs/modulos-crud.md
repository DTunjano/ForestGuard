# Organización de módulos y operaciones

Rama: feature/module-crud-organization, desde fix/ui-select-navigation.

## Distribución

La navegación separa Análisis, Datos y recursos, Soporte y Administración.
Cada listado mantiene sus filtros, paginación, errores y acciones. La creación
y edición se abren bajo demanda en ventanas independientes del listado para
evitar formularios permanentes que ocupaban la mayor parte de la pantalla.

| Módulo | Operaciones disponibles en la web |
| --- | --- |
| Áreas | Buscar, ordenar, listar, consultar detalle, crear, editar y eliminar si no hay imágenes |
| Imágenes | Colección paginada por área, cargar, consultar metadatos y eliminar si no están vinculadas a análisis |
| Usuarios | Listar/buscar, crear y editar en ventanas; activar/desactivar y roles según permisos |
| Análisis | Crear, consultar historial/resultados y eliminar solo completed/failed |
| Modelos | Catálogo de solo lectura, de acuerdo con el contrato real |
| Perfil | Edición de datos permitidos y cambio de contraseña |

No se agregan operaciones de actualización que la API no soporta. Los borrados
requieren confirmación y muestran el error del servidor si existen relaciones
protegidas. No se realizan borrados en cascada de imágenes para eliminar un área.
Al eliminar un análisis se avisa que sus resultados se borran y las imágenes se
conservan. La administración mantiene desactivación de cuentas en vez de borrado.

## Componentes y accesibilidad

Modal y DeleteConfirmation son compartidos. El modal indica título y estado
ocupado, bloquea el fondo, retiene Tab/Shift+Tab y devuelve el foco al control
de origen al cerrar cuando sigue disponible. Escape y el botón de cierre
permiten salir; se bloquea el cierre durante un guardado o borrado pendiente.
Escape en una lista desplegable cierra primero las opciones y conserva el modal.
El portal de los selectores permanece por encima de las ventanas.

Los formularios reutilizan Field/Select/Button, incluyen etiquetas, errores,
prevención de envíos repetidos y controles de longitud. Los paneles y ventanas
se adaptan al ancho disponible; las tablas conservan desplazamiento horizontal
contenido y las acciones pueden saltar de línea. Las descripciones de áreas
usan un campo de varias líneas. El botón de cargar imágenes se habilita al
seleccionar un área y explica el requisito.

## Verificación

Lint, build y cuatro pruebas de cliente HTTP correctos. El recorrido de Edge
se amplió para cubrir CRUD de áreas, cancelación, errores de borrado protegido,
consulta de imágenes, carga/eliminación de un archivo sin uso, ventanas de
usuarios y cancelación del borrado de un análisis. Los datos son sintéticos
y se guardan en PostgreSQL/media de pruebas, sin alterar cuentas personales.
Las capturas están en frontend/test-results/redesign (ignoradas por Git).
El primer recorrido ampliado terminó con **1 passed en 83,05 s**. Se comprobaron
los casos de borrado exitoso de un área sin relaciones y una imagen sin uso;
los registros de análisis se conservaron al cancelar su confirmación.
Verificación final: **1 passed en 77,34 s**, incorporando Tab/Shift+Tab dentro
del modal, Escape en el selector sin cerrar el formulario y formulario de áreas
en móvil. Se revisaron visualmente las capturas de listado de áreas, colección
de imágenes, edición de usuarios y formulario móvil. La singularización del
contador y el texto de disponibilidad del borrado se ajustaron al cierre.

No se modificó el backend, la autenticación, el pipeline ni sus contratos.
Se mantiene pnpm dev y los comandos de API/worker existentes. No hay despliegue
ni publicación remota en esta fase.
