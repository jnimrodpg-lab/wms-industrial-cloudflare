# Corrección: importación completa 10K+ y pestañas estables

Esta versión corrige dos problemas reportados:

## 1. Solo importaba 500 productos

Se cambió el importador para que no tome el tamaño del lote como límite final. Ahora:

- Lee el Sheet completo.
- Limpia productos anteriores de la sucursal.
- Procesa todas las filas por lotes de 1000.
- Guarda cada lote en IndexedDB.
- Actualiza el progreso según filas procesadas.
- Muestra el total real importado al terminar.
- Omite filas sin nombre para evitar productos falsos como “Producto 3568”.

Importante: el buscador no carga los 10 mil productos en pantalla. Los busca dentro de IndexedDB y solo muestra 60 por página.

## 2. La app regresaba de una pestaña a otra

Se agregó persistencia de la pestaña activa en `sessionStorage`.

Ahora, al guardar/importar o actualizar datos, la app debe quedarse en la misma sección.

## Recomendación después de actualizar

1. Entra a **Vincular Sheet / Config. Sheets**.
2. Pulsa **Limpiar productos** si tu versión tiene ese botón, o importa directamente.
3. Pulsa **Leer fila 1**.
4. Verifica que `Nombre` esté mapeado a la columna 12.
5. Pulsa **Importar todos los productos**.
6. Espera hasta ver `Importación completa`.
7. Ve al buscador y prueba por nombre, SKU, barras, zona o estante.

## Si no aparecen productos en la búsqueda

Revisa que el mensaje final de importación diga más de 0 productos. Si dice que omitió muchas filas sin nombre, revisa que la columna `Nombre` tenga datos y que esté mapeada correctamente.
