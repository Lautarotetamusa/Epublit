# Design: Acciones bulk sobre los libros en consignación de un cliente

Estado: aprobado por el usuario

## Historia

"En la vista de detalle de cliente necesito poder seleccionar libros y crear en
bulk una devolución o una venta sobre consignación de esos libros, tal como lo
hacemos en la vista de listado de libros."

## Qué se construyó

En la ficha de cliente (`/clientes/:id`, `front/src/features/clientes/FichaClientePage.tsx`)
la tabla "Libros en consignación" ahora es seleccionable, con el mismo mecanismo
que el catálogo (`Table` con `selectable` + `selectedKeys`/`onSelectionChange` y
`rowKey` por ISBN).

Con al menos un libro tildado aparece una **barra de acciones pegada a la tabla**
que muestra cuántos libros hay seleccionados y ofrece las dos operaciones:

- **Registrar devolución** → `/devoluciones?clienteId=<id>&isbns=<...>`
- **Venta sobre consignación** → `/ventas/nueva?clienteId=<id>&tipoVenta=consignacion&isbns=<...>`

(Esas son rutas del front — pantallas de react-router, no endpoints de la API.)

En los dos destinos el cliente y los libros llegan precargados (cantidad 1,
validada contra el stock real del cliente), y el usuario sólo completa lo que
falta (medio de pago / fecha de venta) y confirma.

La barra vive dentro del `Card`, inmediatamente arriba de la tabla, y no en las
`actions` del `Card` (donde sí está en el catálogo): ese header ya tiene una
acción de lista completa ("Actualizar lista de precios") y acá las operaciones
sobre la selección son dos, así que en el header quedarían apretadas contra el
título y lejos del checkbox que las habilita. El botón "Venta en firme" y todo el
resto del comportamiento de la ficha (edición de datos, datos impositivos,
actualizar precios) quedan igual.

### Archivos

- `front/src/features/clientes/FichaClientePage.tsx` — estado de selección y
  barra de acciones. Se aprovechó para alinear la tabla al sistema de diseño:
  Stock y Precio unit. ahora van en mono y el precio se formatea es-AR (antes
  se renderizaba el número crudo), igual que en el catálogo.
- `front/src/lib/precargaOperacion.ts` (nuevo) — parseo compartido de
  `?clienteId=&isbns=` que antes vivía sólo en `NuevaVentaPage`.
- `front/src/features/ventas/useVentaForm.ts` — la precarga de `isbns` ahora
  funciona también en "Venta sobre consignación": espera a que cargue el stock
  del cliente (antes sólo la aplicaba en "firme", cuando ya había cargado el
  catálogo).
- `front/src/features/consignaciones/useDevolucionForm.ts` — acepta
  `{ clienteId, isbns }` y los aplica en etapas: primero el cliente (que dispara
  la carga del stock), después los libros cuando ese stock ya está disponible.
  Si el cliente precargado no está en el listado de inscriptos, lo agrega para
  que el selector no quede vacío.
- `front/src/features/consignaciones/DevolucionesPage.tsx` — lee la precarga de
  la URL y se la pasa al hook.

### Cómo verlo

`npm run dev` en `/front` (en esta máquina ya estaba corriendo en
http://localhost:5174), entrar con `libreria_sur` / `seed12345`, abrir
`/clientes/5`, tildar libros y usar cualquiera de los dos botones.

## Datos necesarios

**Ninguno / sin cambios.** Las dos operaciones se resuelven enteramente con
capacidades que la API ya expone y que esta pantalla reusa tal cual:

- Registrar la devolución de varios libros de un cliente (ya la usa
  `/devoluciones`).
- Registrar la venta sobre consignación de varios libros de un cliente (ya la
  usa `/ventas/nueva?tipoVenta=consignacion`).
- Leer el stock consignado de un cliente, y leer/editar sus datos (ya los usa la
  ficha hoy).

No hace falta ninguna capacidad nueva ni para precargar los formularios: la
selección viaja por la URL de la propia pantalla y cada formulario ya valida
cantidades contra el stock que ya recibe.

## Nota

Pasada de `front-designer` (agente `front-designer` del flujo de `specs/`),
sesión `ses_f12ca9f57ffe3NNkOwb5fJza8e`.

**Aprobado por el usuario sin ajustes**: se mantiene la barra de selección
pegada a la tabla (no en las `actions` del `Card`) y el copy actual
("Registrar devolución" / "Venta sobre consignación"). El código de la pantalla
no se tocó después de la aprobación.

Próximo paso: `planner` (`/plan-backend 006-bulk-ficha-cliente`). Como los
"Datos necesarios" son ninguno, es esperable que el plan cierre sin tareas de
backend; si el planner encuentra algo, conviene contrastarlo antes de implementar.

Agent: ses_f12ca9f57ffe3NNkOwb5fJza8e
