# WMS Industrial — v106 Stabilization

Versión de limpieza y estabilización para Cloudflare Pages + D1. Esta entrega no agrega funciones visuales nuevas; conserva el editor 2D/3D y corrige deuda técnica que podía provocar rutas inconsistentes, tiempos de arranque innecesarios o exposición de datos entre sesiones.

## Estructura activa

- `public/` — única salida estática publicada por Cloudflare Pages.
- `functions/api/[[path]].js` — única implementación de la API.
- `migrations/0001_init.sql` — esquema base de D1.
- `wrangler.toml` — configuración de Pages/D1.

Ya no existen copias paralelas de `index.html`, `assets/` ni APIs TypeScript antiguas en `functions/api/`.

## Cambios v106

- Eliminadas rutas API antiguas que competían con `functions/api/[[path]].js`.
- `GET /api/app-state` ahora exige sesión válida y nunca cae por defecto en `company_id = 1`.
- Registro de viewer corregido para usar `POST /api/register` con `mode: viewer`.
- Eliminada la lectura de cookies `HttpOnly` desde el frontend.
- Eliminado el precalentamiento incorrecto a `/healthz` y reducidos los reintentos de sesión.
- Eliminada una carga remota duplicada durante el bootstrap.
- Al cerrar sesión se limpia el caché local privado de inventario, layouts y configuración empresarial.
- Un usuario sin sesión ya no rehidrata inventario privado desde `localStorage`; solo ve datos demo.
- Eliminadas credenciales `admin/admin123` de `wrangler.toml`.
- Hash de contraseñas nuevo con PBKDF2-SHA256; hashes antiguos se validan y migran automáticamente al iniciar sesión.
- Endpoints auxiliares de Google Sheets requieren rol administrador.
- Al eliminar una sucursal también se limpian layout, configuración de hoja y links viewer asociados.
- Respuestas API ya no exponen datos internos de routing/debug.

## Credenciales iniciales

La aplicación permite crear una cuenta administradora desde la pantalla de registro. No hay una contraseña de producción incluida en el repositorio.

Si una instalación existente ya tiene usuarios en D1, continúan funcionando. Su hash de contraseña antiguo se migra automáticamente a PBKDF2 después de un inicio de sesión válido.

Las variables `ADMIN_USERNAME` y `ADMIN_PASSWORD` siguen siendo opcionales en el backend únicamente para instalaciones heredadas que quieran sembrar un administrador en la empresa por defecto. Si se usan, deben configurarse como variables/secretos del entorno de Cloudflare, nunca dentro del repositorio.

## Comprobación rápida

```bash
npm run check
```

Esto valida sintaxis del backend y del bundle principal del frontend.

## Siguiente etapa recomendada

La v106 estabiliza la base. La siguiente refactorización debería dividir `public/assets/app-main.runtimefix.js` en módulos internos sin alterar el comportamiento visible.
