# WMS Branch Viewer App

Versión optimizada sin cambiar la base tecnológica principal.

## Mejoras aplicadas

- Persistencia reforzada con tabla `products` en SQLite.
- Sincronización automática de productos importados desde `branch_sheet_config` hacia `products`.
- Nuevos índices para acelerar búsquedas por sucursal, SKU, código de barras, rack, almacén y zona.
- Nuevos endpoints para búsqueda paginada:
  - `GET /api/branches/:id/products`
  - `GET /api/products/search`
  - `GET /api/branches/:id/products-summary`
- Extracción del CSS principal a `public/assets/app.css` para mejorar orden y cacheo.
- Extracción del JS principal a `public/assets/app-main.js` para reducir el peso del `index.html` y preparar modularización futura.

## Ejecutar localmente

```bash
npm install
npm run dev
```

App: `http://localhost:3000`

## Despliegue gratis

### Opción actual
- Render o un VPS/local con Node.js + SQLite.

### Evolución sugerida
- Frontend en Cloudflare Pages.
- API/DB en Cloudflare Workers + D1.

## Notas

- No se modificó la lógica funcional del editor de layout ni del editor de racks.
- La app sigue siendo compatible con el flujo actual basado en Google Sheets.
- `localStorage` puede seguir usándose como apoyo visual, pero la base persistente ya queda mejor preparada en SQLite.


## Fase 2 aplicada

Se añadió una segunda capa de optimización enfocada en rendimiento de búsqueda y carga:

- Endpoints paginados para productos por sucursal.
- Endpoint de búsqueda por API (`/api/products/search`).
- Endpoint de resumen por sucursal (`/api/branches/:id/products-summary`).
- Serialización de productos desde SQLite al formato que ya usa el frontend.
- El frontend ahora intenta cargar productos por API antes de usar caché local.
- Búsqueda del listado conectada al backend cuando hay sesión activa.
- Paginación visible en la barra del listado.
- Caché local reducida a un respaldo ligero, ya no como fuente principal del catálogo.

### Resultado esperado

- Menos carga inicial del navegador.
- Menos lag al buscar.
- Menos dependencia de `localStorage` para productos.
- Mejor base para seguir agregando filtros reales por backend.
