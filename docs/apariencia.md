# Apariencia clara y oscura

El botón de apariencia está en la esquina superior derecha del acceso, registro y todas las pantallas privadas. Muestra el tema actual; al pulsarlo cambia al otro. Es accesible por teclado, tiene un área mínima de 44 px y comunica el estado mediante `aria-pressed`.

La primera visita conserva el modo oscuro existente, independientemente del tema del sistema operativo. La selección se guarda únicamente en `localStorage` bajo `forestguard-theme` y se sincroniza entre pestañas del mismo origen. No modifica la sesión ni requiere una cuenta o petición a la API. Si el almacenamiento no está disponible, se puede alternar durante la visita, sin persistencia.

## Estructura

- `frontend/public/theme-init.js` aplica la preferencia antes de cargar React para evitar un destello del tema incorrecto. Solo acepta `light` y `dark`; el resto vuelve a oscuro. Al cambiar el nombre de la clave o los temas admitidos, actualizar también este inicializador.
- `frontend/src/app/providers/ThemeProvider.jsx` comparte el estado, actualiza `data-theme` y el color del navegador, y escucha cambios entre pestañas.
- `frontend/src/shared/theme/theme.js` contiene la lectura y escritura tolerante a restricciones del navegador.
- `frontend/src/shared/theme/ThemeContext.js` expone el contexto y `useTheme`.
- `frontend/src/shared/components/ThemeToggle.jsx` se reutiliza en acceso y distribución privada.
- `frontend/src/shared/theme/theme.css` define la paleta clara, estados de foco y estilos del selector de tema. `color-scheme` adapta los controles nativos. Sonner recibe el tema elegido.

Los estilos de los módulos utilizan variables semánticas para superficies, texto, estados, bordes y sombras. Cada declaración migrada conserva como valor de respaldo el color oscuro anterior. No se aplican filtros globales de inversión a imágenes, iconos o mapas.

Para nuevos componentes, utilizar las mismas variables, por ejemplo:

```css
.mi-panel {
  background: var(--fg-surface, #0b1728);
  color: var(--fg-ink, #e7edf5);
  border: 1px solid var(--fg-border);
}
```

Mantener los valores oscuros como respaldo o definir expresamente ambas variantes. No emplear un color claro fijo para texto sobre fondos que cambian de tema. Usar `--fg-green-ink`, `--fg-red-ink`, etc. para mensajes de estado y sus variantes `*-wash` para fondos suaves.

## Mapas y resultados

Los píxeles de los rasters, colores de categorías, escalas espectrales y leyendas científicas no dependen del tema. Cambian los contenedores y controles de la web. La selección de categorías y los porcentajes se conservan al alternar. Los PNG, GeoTIFF y PDF descargados conservan su presentación original; no se ejecuta el pipeline nuevamente.

## Comprobaciones

Desde `frontend`:

```powershell
pnpm dev
pnpm lint
pnpm test
pnpm build
```

En otra consola, con Vite activo:

```powershell
$env:FG_TEST_URL = 'http://127.0.0.1:5173'
pnpm test:theme
```

La prueba de navegador usa Edge instalado y respuestas controladas de la API. No escribe en la base de datos ni representa una nueva evaluación del pipeline. Comprueba acceso/registro, 13 rutas privadas, modal, desplegable, teclado, persistencia, sincronización entre pestañas, cuatro pantallas móviles sin desbordamiento horizontal y conservación exacta de los píxeles del mapa al alternar. Capturas en `frontend/test-results/theme/`, excluidas de Git.

Las pruebas unitarias cubren preferencia, valores inválidos, almacenamiento bloqueado y contraste mínimo de 4,5:1 de los textos semánticos contra las superficies compartidas. Esto verifica la paleta; no sustituye una auditoría completa de accesibilidad.

También se corrigió la especificidad de las reglas adaptables de los pasos de análisis y el ajuste de los botones de cabecera para evitar desbordamientos en móvil en ambos temas.
