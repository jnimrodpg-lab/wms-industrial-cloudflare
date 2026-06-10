# WMS Industrial - Cloudflare Pages limpio

Estructura limpia para subir a GitHub y desplegar con Cloudflare Pages + Functions + D1.

## Qué contiene

- `public/`: frontend estático de la app.
- `functions/`: API de Cloudflare Pages Functions.
- `migrations/`: esquema inicial para D1.
- `wrangler.toml`: configuración base de Cloudflare.
- `package.json`: scripts mínimos. No usa Vite ni React build.

## Qué se eliminó

- Carpeta duplicada `app/`.
- Archivos duplicados de server/render/vite.
- SQLite local versionado.
- Configuraciones duplicadas.
- Archivos temporales o de prueba.

## Configuración recomendada en Cloudflare Pages

- Framework preset: `None`
- Build command: vacío, o `npm run build`
- Build output directory: `public`
- Functions directory: `functions`

Luego reemplaza en `wrangler.toml`:

```toml
database_id = "REEMPLAZA_CON_TU_DATABASE_ID"
```

por el ID real de tu base D1.
