# Rediseño de interfaces

## Fase 1 · Auditoría

Base: integration/frontend-backend, 595a1d2. Rama: feature/ui-redesign.
Referencia visual: documento ForestGuard, apartado 7.4, páginas 87–88,
figuras 20–23, renderizadas y revisadas. React 19, Vite 8, Tailwind 4,
React Router 7, Lucide mediante react-icons, Sonner y Playwright ya instalados.

La integración sustituyó composiciones originales por formularios y listados
lineales. En dev se conservan el acceso dividido, los indicadores del dashboard,
tarjetas de actividad, asistente de análisis y tablas administrativas. Se recupera
su lenguaje visual, conservando los hooks y contratos actuales. No se restauran
sesión falsa, cifras inventadas, riesgo futuro ni imágenes ajenas como resultados.

| Módulo | Diferencia y plan |
| --- | --- |
| Acceso | Recuperar composición dividida, marca y explicación del producto |
| Dashboard | Indicadores reales, actividad en tarjetas y acción principal |
| Análisis | Pasos claros, carga diferenciada y paneles técnicos secundarios |
| Historial | Recuperar tabla, filtros alineados, estados y paginación |
| Resultados | Priorizar mapas, separar métricas/exportación y catálogo filtrable |
| Perfil/usuarios/áreas/modelos/ayuda | Aplicar paneles, jerarquía y estados compartidos |

Las figuras contienen riesgo, confianza y avance porcentual no disponibles en
la API. Se sustituyen por cobertura, índices y estados reales. No se modifica
backend ni autenticación. No se añaden dependencias.

## Fases 2–6 · Sistema y aplicación

Superficies azul carbón, verde vegetal para acciones, lima para identidad;
tipografía del sistema, escala de espaciado de 4 px, bordes discretos, radios
12–20 px, sombras y foco visibles. Lucide es la familia de iconos compartida.
Controles de al menos 44 px, tablas con desplazamiento contenido, formularios
adaptables y animaciones desactivadas con prefers-reduced-motion.

Los componentes compartidos conservan firmas y etiquetas accesibles. Las
notificaciones incorporan iconos y contenedores de estado. Los estados vacíos
usan orientación y acciones reales. Los mapas siguen siendo archivos privados.
No se incorporan controles destructivos nuevos a esta fase.

## Validación

Registrar resultados de lint, build, pruebas de cliente, recorrido integrado y
capturas de escritorio, tableta y móvil al finalizar. Las capturas y los renders
del PDF son archivos temporales ignorados en frontend/test-results.

## Entrega por fases

| Fase | Archivos y resultado | Verificación / commit |
| --- | --- | --- |
| 1 | Este documento; comparación de PDF 7.4 y código de dev | Renders de páginas 87–88; cf86a7c |
| 2 | shared/components/UI.jsx, index.css; paneles, encabezados, foco, avisos e iconos | Lint y build; b497ae1 |
| 3 | AuthPage, Dashboard, History, NewAnalysis, Results | Acceso dividido, actividad real, tabla y mapas prioritarios; 357e2c8 |
| 4 | Users, Models, StudyAreas, componentes compartidos; perfil y ayuda heredan el sistema | Tabla administrativa, tarjetas y paneles consistentes; 80d4951 |
| 5–6 | ArtifactCard, MainLayout, Navbar, ProfileDropdown, UI y CSS | Descargas secundarias, estados reales, Lucide, salto al contenido, contraste, movimiento reducido; 318a15b |
| 7 | frontend/tests/integration.mjs | Capturas y recorrido real en Edge; commit final de pruebas |

No se eliminaron archivos, funcionalidades ni dependencias en este rediseño.
Los componentes de perfil y ayuda mantienen sus flujos; su presentación cambia
a través del sistema compartido y estilos específicos adaptables. El menú
existente se conserva y mejora su contraste. El backend no tiene cambios.

## Evidencia visual y funcional

Primer recorrido integrado: 1 passed en 75,17 s. Procesó escenas sintéticas con
PostgreSQL y pipeline reales, verificó sesión, roles, perfil, usuarios, análisis
individual/comparativo y descargas privadas. Lint, build y las cuatro pruebas
del cliente HTTP pasaron. Bundle JS de construcción: aproximadamente 338 kB
(104 kB gzip), sin dependencias nuevas. No es una medición de rendimiento de campo.

Capturas revisadas: login, carga, historial, análisis individual y dashboard en
1440×1000, 768×1024 y 390×844. El mapa de las capturas es sintético y no representa
un resultado científico real. Se observa una lámina principal desplegada; las
restantes pueden abrirse individualmente. Los filtros y exportaciones se conservan.

Se calcularon contrastes de tres parejas del sistema: texto secundario sobre
panel 8,73:1, texto de botón sobre lima 11,12:1 y texto principal sobre panel
13,95:1. Esto no constituye una auditoría integral ni certificación WCAG 2.2 AA.
El recorrido ampliado comprueba foco de teclado en el salto al contenido,
navegación, ausencia de errores JS, reducción de movimiento y capturas adicionales.
Ese recorrido pasó en 55,27 s. Se observaron capturas de perfil, modelos, áreas,
usuarios y ayuda. Las dos últimas se tomaron durante una transición del menú;
la prueba visual ahora espera explícitamente a que su ancho alcance el estado
final antes de capturar. No se utilizan capturas intermedias como entrega visual.
La ejecución final, con animaciones detenidas para las capturas, pasó en 53,52 s.
Se volvieron a inspeccionar usuarios y ayuda: el contenido queda visible sin
superposición del lateral. Las capturas finales permanecen en
`frontend/test-results/redesign/` (ignoradas por Git).

## Cómo revisar

En frontend: `pnpm dev`. API y worker se ejecutan como antes en sus consolas.
No hay migraciones, variables ni dependencias nuevas. Las pruebas se repiten con
los comandos de docs/integracion-local.md. La rama de rediseño parte de 595a1d2;
no se fusiona a dev/main ni se publica sin una instrucción posterior.

Las mejoras científicas y la validación independiente de v9 siguen fuera de
esta fase. El prototipo de probabilidades, selección geográfica y cancelación
de trabajos no se habilita como función simulada: necesita soporte de API antes
de convertirse en una interacción real. Se conserva la descarga de PNG y GeoTIFF.
