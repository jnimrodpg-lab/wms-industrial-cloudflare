# WMS Industrial Cloudflare

App WMS preparada para desplegar en GitHub + Cloudflare Pages/Functions.

## Qué incluye esta versión

- Frontend en `public/index.html`.
- CSS principal en `public/assets/app.css`.
- JS principal activo en `public/assets/app-main.runtimefix.js`.
- Functions/API en `functions/api`.
- Migración D1 en `migrations/0001_init.sql`.
- Ejemplo de Sheet en `public/ejemplo-sheet.csv`.

## Cambios V15

- Se eliminó la franja/sombra decorativa que aparecía en la parte inferior del editor de layout.
- Se dejó el canvas de edición más limpio: grilla visible, fondo técnico y sin overlay oscuro.
- Se actualizó el cache del script para Cloudflare.
- Se retiraron archivos históricos y duplicados que no eran necesarios para el deploy.

## Despliegue

1. Sube este contenido a tu repositorio de GitHub.
2. En Cloudflare Pages, conecta el repositorio.
3. Usa la carpeta raíz del proyecto.
4. Si Cloudflare solicita comando de build y no usas build, déjalo vacío o usa el flujo de Pages Functions según tu configuración.
5. Aplica la migración D1 incluida en `migrations/0001_init.sql` si tu proyecto usa D1.

## Nota

El archivo `public/assets/app-main.js` legacy fue eliminado porque `public/index.html` usa `app-main.runtimefix.js`.
