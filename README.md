# WMS Industrial en Cloudflare Pages + D1

Este paquete migra tu WMS desde Express + SQLite en Render a **Cloudflare Pages Functions + D1**.

## Qué incluye
- Frontend estático en `public/index.html`
- API serverless compatible con tu frontend actual en `functions/api/[[path]].js`
- Persistencia en D1 para layouts, racks, vinculación de Sheets y links de visualización por sucursal
- Script para exportar tu SQLite legado a SQL compatible con D1

## Pasos
1. Instala dependencias:
   `npm install`
2. Crea la base D1:
   `npm run d1:create`
3. Copia el `database_id` generado y colócalo en `wrangler.toml`
4. Aplica el esquema base:
   `npm run d1:migrate`
5. Opcional: exporta tu SQLite legado:
   `npm run export:legacy -- ./ruta/a/wms.sqlite ./migrations/legacy-export.sql`
6. Importa ese SQL a D1:
   `wrangler d1 execute wms-industrial-db --file=./migrations/legacy-export.sql`
7. Prueba localmente:
   `npm run dev`
8. Despliega a Pages:
   `npm run deploy`

## Variables importantes
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `DEFAULT_COMPANY_NAME`
- `DEFAULT_COMPANY_CODE`

## Nota
La API mantiene las rutas `/api/...` que ya usa tu frontend, por lo que la migración visual es mínima.
