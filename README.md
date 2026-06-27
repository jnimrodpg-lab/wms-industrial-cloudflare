# WMS Industrial – v70

Se aplicaron mejoras enfocadas en la visualización del espacio del local y se limpiaron archivos innecesarios del paquete.

## Mejoras aplicadas
- Muros 3D levantados automáticamente desde las aristas de las zonas del layout.
- Lectura espacial más clara en el visor WebGL: ahora el local se percibe como un recinto y no solo como una base con racks.
- Muros activos más visibles; muros no activos quedan más suaves para mantener contexto sin saturar.
- Ajuste del texto del modal 3D para reflejar que el visor muestra el espacio del local.

## Limpieza del paquete
- Se eliminaron archivos de cambios históricos, duplicados de `public/index.html`, assets duplicados bajo `public/assets`, ejemplo CSV y scripts auxiliares.
- Se conservó solo lo necesario para ejecutar/desplegar el proyecto:
  - `index.html`
  - `assets/`
  - `functions/`
  - `migrations/`
  - `_redirects`
  - `package.json`, `package-lock.json`, `wrangler.toml`
