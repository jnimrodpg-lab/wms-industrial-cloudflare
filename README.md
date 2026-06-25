# WMS Industrial Cloudflare

App WMS preparada para desplegar en GitHub + Cloudflare Pages/Functions.

## Qué incluye esta versión

- Frontend en `public/index.html`.
- CSS principal en `public/assets/app.css`.
- JS principal activo en `public/assets/app-main.runtimefix.js`.
- Functions/API en `functions/api`.
- Migración D1 en `migrations/0001_init.sql`.
- Ejemplo de Sheet en `public/ejemplo-sheet.csv`.

## Cambios V16

- Se mantiene el canvas de edición limpio, con grilla visible y sin overlay oscuro.
- Se agregó panel derecho de propiedades para zonas y racks.
- Se agregaron capas visibles/ocultas: grilla, zonas, racks, etiquetas, cotas y mini mapa.
- Se agregaron plantillas rápidas para crear zona + rack, almacén, fila de racks y distribuir racks.
- Se agregó soporte para imagen de fondo del plano.
- Se agregó mini mapa del layout.
- Se eliminaron archivos auxiliares no usados para evitar conflictos en Cloudflare Functions.
- Se actualizó el cache/build a `cloudflare-v16-layout-tools`.

## Despliegue

1. Sube este contenido a tu repositorio de GitHub.
2. En Cloudflare Pages, conecta el repositorio.
3. Usa la carpeta raíz del proyecto.
4. Si Cloudflare solicita comando de build y no usas build, déjalo vacío o usa el flujo de Pages Functions según tu configuración.
5. Aplica la migración D1 incluida en `migrations/0001_init.sql` si tu proyecto usa D1.

## Nota

El archivo `public/assets/app-main.js` legacy fue eliminado porque `public/index.html` usa `app-main.runtimefix.js`.
