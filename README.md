# WMS Industrial listo para publicación

Esta versión está preparada para ejecutarse localmente o desplegarse en un servicio Node.js como Render.

## Qué incluye
- Persistencia local con SQLite en `data/wms.sqlite`
- Login de administrador
- Guardado de layouts
- Guardado de modelos de rack
- Frontend servido desde `public/`

## Credenciales iniciales
- Usuario: `admin`
- Contraseña: `admin123`

## Ejecutar localmente
```bash
npm install
npm start
```
Luego abre `http://localhost:3000`

## Variables de entorno
Copia `.env.example` y define al menos:
- `SESSION_SECRET`
- `PORT` (opcional)
- `NODE_ENV=production` en despliegue

## Publicar en Render
1. Sube este proyecto a GitHub.
2. Crea un nuevo servicio Web en Render.
3. Usa:
   - Build Command: `npm install`
   - Start Command: `npm start`
4. Agrega un disco persistente montado en `/opt/render/project/src/data`
5. Configura `SESSION_SECRET` como variable de entorno.

## Estructura importante
- `server.js`: backend Express + API + SQLite
- `public/index.html`: frontend principal
- `data/wms.sqlite`: base de datos actual

## Nota
No se incluye `node_modules` en este ZIP. Ejecuta `npm install` después de descargarlo.
