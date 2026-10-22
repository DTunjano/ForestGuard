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
