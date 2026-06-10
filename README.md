# WMS Visual Interno V1

Aplicación web inicial para encontrar la ubicación de productos en una tienda/almacén con sucursales, Google Sheets, buscador, cards, editor básico de plano y editor básico de estantes.

## Qué incluye esta versión

- Login inicial.
- Roles: administrador y visualizador.
- Sidebar con módulos principales.
- Configuración de empresa.
- Creación de sucursales.
- Vinculación de Google Sheets por URL y nombre de hoja.
- Lectura de encabezados desde fila 1.
- Mapeo de columnas.
- Importación de productos.
- Buscador por nombre, SKU, código, marca, zona, estante, nivel, slot y almacén.
- Cards con imagen del producto.
- Editor básico de zonas en plano.
- Editor básico de estantes con niveles y columnas.
- Vista de plano con resaltado de zona y estante.
- Estructura preparada para Cloudflare Pages + D1.

## Usuarios iniciales

Administrador:

```txt
Correo: admin@empresa.com
Clave: admin123
```

Visualizador:

```txt
Correo: visor@empresa.com
Clave: visor123
```

## Cómo probarlo en tu computadora

Necesitas instalar Node.js. Después:

```bash
npm install
npm run dev
```

Luego abre la URL que aparece en la terminal, normalmente:

```txt
http://localhost:5173
```

## Cómo debe estar tu Google Sheet

La fila 1 debe tener encabezados. Ejemplo:

```txt
Nombre Bsale | SKU | Barras | Marca | Categoria | Imagen | Stock | Zona | Estante | Nivel | Ubicacion | Almacen
```

Luego, dentro de la app:

1. Crea una sucursal.
2. Entra a Config. Sheets.
3. Selecciona la sucursal.
4. Pega la URL del Google Sheet.
5. Escribe el nombre exacto de la hoja.
6. Presiona “Leer fila 1”.
7. Mapea las columnas.
8. Presiona “Guardar e importar”.

## Importante sobre Google Sheets

Para que la app pueda leer el Sheet sin usar API de pago ni OAuth, el archivo debe estar accesible como CSV.

Forma simple:

1. Abre Google Sheets.
2. Clic en Compartir.
3. Cambia a “Cualquier persona con el enlace puede ver”.
4. Usa la URL normal del Sheet en la app.

La app intentará convertir la URL automáticamente a formato CSV.

## Sobre almacenamiento

Esta versión tiene dos capas:

### Modo local inmediato

La app ya funciona en el navegador usando `localStorage` para que puedas verla y probar el flujo sin configurar Cloudflare.

### Modo producción recomendado

La carpeta ya incluye:

- `functions/api`: APIs para Cloudflare Pages Functions.
- `migrations/0001_init.sql`: estructura inicial de Cloudflare D1.
- `wrangler.toml`: configuración base.

La siguiente fase será conectar completamente el frontend con esas APIs para que todo quede persistido en Cloudflare D1 y se pueda usar desde varios dispositivos.

## Cómo preparar Cloudflare D1 gratis

1. Crea una cuenta en Cloudflare.
2. En Cloudflare, crea un proyecto Pages conectado a GitHub.
3. Crea una base D1 llamada:

```txt
wms_visual_v1
```

4. Copia el `database_id` y reemplázalo en `wrangler.toml`:

```toml
database_id = "REEMPLAZA_CON_TU_DATABASE_ID"
```

5. Ejecuta la migración:

```bash
npx wrangler d1 migrations apply wms_visual_v1
```

6. Build de la app:

```bash
npm run build
```

7. Deploy:

```bash
npm run cf:deploy
```

## Archivos principales

```txt
src/main.tsx          App principal
src/styles.css        Estilos visuales
functions/api         APIs para Cloudflare Pages
migrations            Base de datos D1
wrangler.toml         Configuración Cloudflare
README.md             Guía de uso
```

## Próxima mejora recomendada

La próxima fase debe ser:

1. Conectar el frontend directamente a Cloudflare D1.
2. Dejar `localStorage` solo como respaldo.
3. Hacer el editor de plano con drag & drop real.
4. Mejorar el editor de estantes con plantillas.
5. Agregar modo tablet/celular más fino.

