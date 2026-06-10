# Formato de Google Sheet adaptado

Esta versión reconoce automáticamente el siguiente orden de columnas:

1. Genero
2. Categoria
3. Estado
4. marca
5. cod / modelo
6. GROSOR
7. talla
8. color
9. Linea
10. Barras
11. Sku
12. Nombre
13. Variante
14. Zona principal
15. Estante principal
16. Nivel principal
17. Slot principal
18. Ubicación
19. Zona secundaria
20. Estante secundario
21. Nivel secundario
22. Slot secundario
23. Almacen
24. P.Lista(+igv)
25. Cant. Restock

## Regla aplicada

La app usa el primer bloque de ubicación como principal:

- Zona, Estante, Nivel, Slot de columnas 14 a 17.

Si esos campos están vacíos, usa el segundo bloque como respaldo:

- Zona, Estante, Nivel, Slot de columnas 19 a 22.

`Cant. Restock` se usa como stock inicial.

## Duplicados de encabezados

Como tienes columnas repetidas llamadas Zona, Estante, Nivel y Slot, el mapeador ahora trabaja por posición de columna, por ejemplo:

- 14. Zona
- 19. Zona

Así se evita que la app confunda una Zona con la otra.
