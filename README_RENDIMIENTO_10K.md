# Corrección para más de 10 mil productos

Esta versión corrige el problema de pantalla blanca cuando se importan hojas grandes de Google Sheets.

## Qué se cambió

1. Los productos ya no se guardan dentro de `localStorage`.
2. Los productos ahora se guardan en `IndexedDB`, una base de datos interna del navegador con mucha mayor capacidad.
3. La importación se hace por lotes de 500 productos.
4. Durante la importación aparece una barra de progreso.
5. El buscador no renderiza todos los productos; muestra 60 resultados por página.
6. Las imágenes de producto cargan en modo `lazy loading`.
7. Se agregó un `ErrorBoundary` para evitar pantalla blanca total si ocurre un error.
8. El dashboard calcula estadísticas leyendo IndexedDB, no cargando todo en memoria.

## Importante

Esta corrección mejora mucho el rendimiento en modo navegador/local. Sin embargo, para uso real desde varios dispositivos, lo ideal sigue siendo pasar productos y configuración crítica a Cloudflare D1.

## Recomendación para Google Sheets grandes

- Evita fórmulas pesadas en la hoja publicada.
- Mantén una fila 1 limpia con encabezados.
- Usa URLs directas de imágenes, no imágenes insertadas dentro de celdas.
- No importes columnas innecesarias si no serán usadas.
- Si el Sheet supera 50 mil productos, conviene migrar la importación al backend.
