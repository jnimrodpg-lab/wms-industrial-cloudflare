V76 - Muros continuos y unión de esquinas

Corrección principal:
- Se eliminó la construcción de muros como cajas independientes con extensión.
- Ahora los muros automáticos se generan como prismas desde la huella real de la arista + espesor.
- Las esquinas contiguas usan intersección/miter de los bordes externos para cerrar mejor.
- Esto reduce cruces, solapes y placas atravesadas en 3D.

Lógica aplicada:
- La arista de la zona queda como cara interior/base del muro.
- El espesor se proyecta hacia dentro o fuera según side.
- Cuando dos paredes contiguas tienen el mismo lado, sus bordes externos se intersectan y se unen.
- En 3D se genera un prisma desde esa huella 2D, evitando bloques desfasados.

Pendiente recomendado:
- En una siguiente versión se puede crear un único mesh por cadena continua de paredes, para un acabado todavía más limpio en T/intersecciones complejas.
