# ForestGuard · Frontend integrado

React + Vite + Tailwind + React Router. Se mantienen pnpm y pnpm-lock.yaml.

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

Vite muestra la dirección local (habitualmente http://localhost:5173). El proxy
/api apunta a Django en http://127.0.0.1:8000. Backend y worker se ejecutan por
separado, con su entorno virtual. Solo PostgreSQL requiere Docker.

## Verificación

```powershell
pnpm lint
pnpm test
pnpm build
```

La prueba de navegador completa se inicia desde backend con
FORESTGUARD_BROWSER_TEST=1; consulta [la guía local](../docs/integracion-local.md).
Usa PostgreSQL de pruebas, GeoTIFF sintéticos y Edge headless. No usa cuentas
personales ni escribe resultados en backend/media.

## Estructura

- src/app: proveedores de sesión y rutas protegidas.
- src/features: autenticación, perfil, usuarios, modelos, áreas, imágenes,
  análisis y resultados. Las páginas consumen APIs y hooks.
- src/shared/api: HTTP, renovación única, consultas cancelables y descargas.
- src/shared/components: formularios y estados comunes.
- src/components/layout: layout visual conservado del frontend original.

No hay administrador predeterminado ni resultados simulados. Registra una cuenta
analista o utiliza una existente. El registro público no asigna rol admin.

## Configuración

VITE_API_URL=/api/v1/ es el valor predeterminado (ver .env.example). Es una
variable pública: nunca incluyas contraseñas ni JWT. FORESTGUARD_API_TARGET
configura el destino del proxy de Vite; por defecto http://127.0.0.1:8000.
Si se usa una API en otro origen sin proxy, Django debe permitir explícitamente
el origen local de la web. No habilites CORS indiscriminadamente.

La sesión conserva el refresh en sessionStorage y el access en memoria; revisa
la decisión y sus límites en la guía. No se ha desplegado la app.
