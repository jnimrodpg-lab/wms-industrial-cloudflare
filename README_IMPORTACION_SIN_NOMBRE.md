# Corrección: no importar productos sin nombre

Esta versión evita que se agreguen productos con nombres automáticos como `Producto 3568`.

## Cambio aplicado

Durante la importación, la app revisa la columna **Nombre** del formato:

```txt
Genero | Categoria | Estado | marca | cod / modelo | GROSOR | talla | color | Linea | Barras | Sku | Nombre | Variante | Zona | Estante | Nivel | Slot | Ubicación | Zona | Estante | Nivel | Slot | Almacen | P.Lista(+igv) | Cant. Restock
```

Si la celda de **Nombre** está vacía, esa fila se omite y no se guarda en IndexedDB ni en la base D1.

## Resultado esperado

- Ya no aparecerán cards llamadas `Producto XXXX`.
- La importación mostrará cuántas filas fueron omitidas por no tener nombre.
- Si todas las filas están sin nombre, se mostrará un error indicando revisar la columna Nombre.

## Recomendación

Después de reemplazar esta versión, vuelve a importar la sucursal desde **Config. Sheets** para limpiar los productos anteriores que sí se habían guardado con nombres automáticos.
