# Tasks: Migrar los módulos `transaccion` y `venta`

Plan de referencia: specs/005-migrar-transaccion-venta/plan.md
Spec de referencia: specs/005-migrar-transaccion-venta/spec.md
Referencia de forma de archivos: módulo `cliente` ya migrado (004) —
`src/schemas/clientes.schema.ts`, `src/validators/cliente.validator.ts`,
`src/filters/cliente.filter.ts`, `src/services/cliente.service.ts`,
`src/services/clienteStock.service.ts`, `src/services/libro.service.ts`.

Cada tarea es chica, verificable de forma independiente, y en orden de
dependencia. Marcar `[x]` al completarla y agregar una línea con lo que
efectivamente se hizo si difiere del enunciado.

Nota general sobre alcance: este feature borra por completo
`src/models/transaccion.model.ts`, `src/models/venta.model.ts` y
`src/models/user.model.ts` (huérfano tras este feature, ver plan, "Hallazgo
previo"). `src/models/libro.model.ts`/`src/models/persona.model.ts` (MySQL)
**no se tocan**: siguen vivos por `liquidacion.controller.ts`. Ver plan,
"Capas afectadas".

Nota sobre la migración MySQL: igual que en 004, no se escribe la migración
`_up`/`_down` que dropea `transacciones`/`ventas`/`libros_transacciones` en
MySQL — se difiere a la baja completa de `db/migrations/` en una etapa
posterior. Ninguna tarea de abajo toca esa carpeta.

## Capa 0: schema + migración Postgres

- [x] T1. Editar `src/schemas/transacciones.schema.ts`: cambiar
  `id: integer("id").primaryKey().generatedAlwaysAsIdentity()` por
  `id: integer("id").generatedAlwaysAsIdentity().unique()` y envolver la
  definición de la tabla en la forma de tercer argumento (callback de
  columnas extra) con `primaryKey({ columns: [table.id, table.user] })`
  (importar `primaryKey` de `drizzle-orm/pg-core`) — mismo patrón que
  `clientesTable` en 004 (`.unique()` en `id` sola porque
  `ventasTable.id_transaccion`/`librosTransaccionesTable.id_transaccion`
  referencian esta columna sola, y Postgres exige unicidad para el FK). No
  tocar `transaccionTipoEnum` ni el resto de las columnas
  (`fecha`, `id_cliente`, `file_path`, `type`, `user`). No tocar
  `src/schemas/ventas.schema.ts` ni `src/schemas/librosTransacciones.schema.ts`
  (plan, "Modelo de datos": ninguna de las dos necesita ajuste de PK).

- [x] T2. Generar la migración Postgres: correr `npm run db:generate`
  (drizzle-kit) a partir del cambio de T1 y revisar a mano el SQL resultante
  en `db/migrations_pg/`. A diferencia de la migración de PK de
  `clientesTable` en 004, acá no hay filas reales pre-existentes que puedan
  violar la nueva PK compuesta (todavía no hay transacciones migradas en
  producción, ver plan, "Capas afectadas"), así que el riesgo es menor. Si
  drizzle-kit no puede resolver solo el nombre del constraint de la PK vieja
  (mismo problema ya visto en 002/004), corregirlo a mano en el SQL generado.
  No aplicar todavía contra la base compartida sin confirmar acceso a un
  entorno de prueba real.
  - Generada como `db/migrations_pg/0004_robust_bloodaxe.sql`; drizzle-kit no
    pudo resolver el nombre del constraint viejo (mismo problema ya visto en
    002/004), corregido a mano con `transacciones_pkey` (confirmado por
    convención, no aplicado contra una base real para verificar el nombre
    exacto — mismo criterio ya usado en la migración de `clientes`).

## Capa 1: validators

- [x] T3. En `src/validators/transaccion.validator.ts`, agregar el grupo
  `transaccionValidator` (Postgres/Drizzle) sin tocar `tipoTransaccion`/
  `TipoTransaccion`/`createTransaccion` (se mantienen, son zod puro sin
  dependencia de MySQL, reutilizados como `bodyParser` de
  `consignacion`/`devolucion` en `operacion.config.ts`, ver T15/T18) ni
  borrar `transaccionSchema`/`saveTransaccion` todavía (se borran en T24
  junto con `transaccion.model.ts`, su único consumidor):
  - `select = createSelectSchema(transaccionesTable)`.
  - `insert = createInsertSchema(transaccionesTable).omit({ id: true })`.
  - `pk = createPkSchema(transaccionesTable).pick({ id: true })`.
  - `export type TransaccionRow = z.infer<typeof select>` — el tipo interno
    de una fila de `transaccionesTable`, insumo de `TransaccionConCliente`
    (T7) y `LibroOperacion`/`OperacionConfig` (T7).
  - Exportar `export const transaccionValidator = { select, insert, pk }`,
    mismo patrón que `clienteValidator`. Importar `transaccionesTable` de
    `../schemas/transacciones.schema`, `createInsertSchema`/
    `createSelectSchema` de `drizzle-zod`, `createPkSchema` de `bradb`.

- [x] T4. En `src/validators/venta.validator.ts`, agregar el grupo
  `ventaValidator` (Postgres/Drizzle) sin tocar `medioPago`/
  `tiposComprobantes`/`createVenta`/`createVentaConsignado` (se mantienen,
  zod puro, reutilizados como `bodyParser` de `venta`/`ventaConsignacion`)
  ni borrar `ventaSchema`/`saveVenta` todavía (se borran en T25 junto con
  `venta.model.ts`):
  - `select = createSelectSchema(ventasTable)`.
  - `insert = createInsertSchema(ventasTable).omit({ id_transaccion: true })`.
  - `export type VentaRow = z.infer<typeof select>`.
  - Exportar `export const ventaValidator = { select, insert }`. Importar
    `ventasTable` de `../schemas/ventas.schema`.

- [x] T5. En `src/validators/libro.validator.ts`, corregir el comentario del
  bloque "Validators viejos (MySQL)" (línea ~39-42): sacar
  `src/models/transaccion.model.ts` y `src/models/venta.model.ts` de la
  lista de consumidores de `libroCantidad` (se borran en T24/T25) y agregar
  `src/services/operacion.config.ts` (via `createTransaccion`/`createVenta`/
  `createVentaConsignado`, que siguen usando `libroCantidad` — ver T3-T4).
  No tocar la definición de `libroCantidad` ni ningún otro schema del
  archivo.

- [x] T6. En `src/validators/user.validator.ts`, corregir el comentario del
  bloque "Validators viejos" (línea ~45-47): ya no aplica a
  `models/user.model.ts` (se borra en T26); dejar que ese bloque sigue vivo
  únicamente por `middleware/auth.ts` (`TokenUser`), que no depende de la
  clase `User` de MySQL. No tocar ningún schema del archivo.

## Capa 2: tipos de servicio

- [x] T7. Crear `src/services/operacion.types.ts` con los contratos internos
  (no HTTP, ver plan "Capas afectadas"):
  - `export type LibroOperacion = { id_libro: number; isbn: string; titulo:
    string; cantidad: number; precio: number; stock: number }` — shape
    compartido devuelto por `resolverLibros` de las cuatro operaciones y por
    `transaccionService.getLibros`.
  - `export type TransaccionConCliente = TransaccionRow & { nombre_cliente:
    string; cuit: string | null; email: string | null; cond_fiscal: string |
    null; tipo_cliente: TipoCliente | null }` (importar `TransaccionRow` de
    `../validators/transaccion.validator`, `TipoCliente` de
    `../validators/cliente.validator`) — resultado del JOIN
    `transacciones`+`clientes` que hace `transaccionService.getAll`/`getById`
    (T8).
  - `export type ComprobanteCtx = { transaction: TransaccionConCliente; venta:
    VentaRow | null; libros: LibroOperacion[]; cliente: Client; userId:
    number }` (importar `VentaRow` de `../validators/venta.validator`,
    `Client` de `../validators/cliente.validator`) — `venta` es `null` para
    `consignacion`/`devolucion`.
  - `export type OperacionConfig = { tipo: TipoTransaccion; filesFolder:
    string; esVenta: boolean; bodyParser: ZodSchema; clientValidation:
    (tipo: TipoCliente) => boolean; resolverLibros: (libros: LibroCantidad[],
    cliente: Client, userId: number, args?: { fecha?: Date }) =>
    Promise<LibroOperacion[]>; moverStock: (libros: LibroOperacion[], cliente:
    Client, tx: Tx) => Promise<void>; generarComprobante: ((ctx:
    ComprobanteCtx, tx: Tx) => Promise<void>) | null }` (importar
    `TipoTransaccion` de `../validators/transaccion.validator`,
    `LibroCantidad` de `../validators/libro.validator`, `ZodSchema` de
    `zod`; `Tx` = el tipo de transacción de Drizzle, ver cómo lo tipa
    `db.transaction` en `cliente.service.ts`/`libro.service.ts` — usar
    `Parameters<typeof db.transaction>[0] extends (tx: infer T) => any ? T :
    never` o el helper que ya exista en el proyecto para no duplicar la
    inferencia a mano si hay uno).

## Capa 3: services de lectura/escritura

- [x] T8. Crear `src/services/transaccion.service.ts` — parte 1
  (`insert`, `saveLibros`, `buildFileUrl`):
  - `insert(body: TransaccionInsert, tx: Tx): Promise<TransaccionRow>`:
    `const [row] = await tx.insert(transaccionesTable).values(body).returning();
    return row;` (usa `transaccionValidator.insert` como tipo de `body`).
  - `saveLibros(libros: LibroOperacion[], idTransaccion: number, tx: Tx):
    Promise<void>`: bulk insert en `librosTransaccionesTable`
    (`id_transaccion, id_libro, cantidad, precio` por cada libro).
  - `buildFileUrl(fileName: string, folder: string): string`: reemplazo de
    `Transaccion.parsePath` (ahora función pura, sin estado) — mismo cálculo
    que hoy (`fileName === "" ? "" : \`${filesUrl}/${folder}/${fileName}\``,
    importar `filesUrl` de `../app`).
  - Exportar por ahora `{ insert, saveLibros, buildFileUrl }` en
    `transaccionService` (se completa en T9).

- [x] T9. En `src/services/transaccion.service.ts` — parte 2 (`getAll`,
  `getById`, `getLibros`):
  - `getAll(tipo: TipoTransaccion, userId: number): Promise<TransaccionConCliente[]>`:
    JOIN `transaccionesTable` + `clientesTable` (`ON id_cliente = clientes.id`),
    `WHERE type = tipo AND transacciones.user = userId`, `ORDER BY
    transacciones.id DESC` — reemplaza `Transaccion.getAll`. La verificación
    de dueño es este `WHERE user = ?` explícito, no la PK compuesta (ver
    plan, "Modelo de datos").
  - `getById(id: number, userId: number): Promise<TransaccionConCliente>`:
    mismo JOIN, `WHERE transacciones.id = id AND transacciones.user =
    userId`; `NotFound` si no hay filas (mismo criterio que
    `clienteService.findOne`, no un chequeo aparte).
  - `getLibros(idTransaccion: number): Promise<LibroOperacion[]>`: JOIN
    `librosTransaccionesTable` + `librosTable` (`isbn, titulo, cantidad,
    precio` de `libros_transacciones`, `stock` actual de `libros`),
    `WHERE id_transaccion = idTransaccion` — reemplaza
    `Transaccion.getLibros`/`LibroTransaccion`.
  - Exportar `transaccionService = { insert, saveLibros, buildFileUrl,
    getAll, getById, getLibros }`.

- [x] T10. Crear `src/services/venta.service.ts` — parte 1 (`insert`,
  `calcTotal`):
  - `insert(idTransaccion: number, body: Omit<VentaInsert, 'id_transaccion'>,
    tx: Tx): Promise<VentaRow>`: `const [row] = await
    tx.insert(ventasTable).values({ ...body, id_transaccion: idTransaccion
    }).returning(); return row;`.
  - `calcTotal(libros: LibroOperacion[], descuento: number): number`: copia
    exacta de `Venta.calcTotal` actual (`reduce` cantidad*precio, aplicar
    `descuento` %, redondear a 2 decimales con `parseFloat(toFixed(2))`) —
    función pura, sin cambios de lógica (plan, "Enfoque técnico").
  - Exportar por ahora `{ insert, calcTotal }` en `ventaService` (se completa
    en T11).

- [x] T11. En `src/services/venta.service.ts` — parte 2 (`getAll`,
  `getById`) y export final:
  - `getAll(tipo: 'venta' | 'ventaConsignacion', userId: number)`: JOIN
    `ventasTable` + `transaccionesTable` + `clientesTable`, `WHERE
    transacciones.type = tipo AND transacciones.user = userId`, `ORDER BY
    ventas.id_transaccion DESC` — reemplaza `Venta.getAll`.
  - `getById(id: number, userId: number)`: mismo JOIN de a tres, `WHERE
    transacciones.id = id AND transacciones.user = userId`; `NotFound` si no
    hay filas.
  - Exportar `ventaService = { insert, calcTotal, getAll, getById }`.

- [x] T12. En `src/services/libro.service.ts`, agregar `moveStock(idLibro:
  number, delta: number, tx?: Tx): Promise<void>`: `UPDATE libros SET stock
  = stock + delta WHERE id_libro = idLibro` (incremento atómico en SQL, no
  lectura-modificación-escritura en JS — ver plan, "Enfoque técnico"), usando
  `tx ?? db` como ejecutor para poder participar de una transacción externa.
  Reemplaza `Libro.updateStock` (MySQL), que no tenía hoy equivalente en
  Postgres. Agregar `moveStock` al export final `libroService`.

- [x] T13. En `src/services/clienteStock.service.ts`, agregar
  `moveStock(clienteId: number, libro: { id_libro: number; precio: number },
  delta: number, tx?: Tx): Promise<void>`: `INSERT INTO libro_cliente
  (id_libro, id_cliente, precio, stock) VALUES (...) ON CONFLICT (id_libro,
  id_cliente) DO UPDATE SET stock = libro_cliente.stock + excluded.stock`
  (usar `db.insert(libroClienteTable).values(...).onConflictDoUpdate(...)`
  de Drizzle), usando `tx ?? db` como ejecutor. Reemplaza
  `cliente.addStock`/`cliente.reduceStock` (`stockDeClienteNoMigrado()`
  hoy). Un único upsert cubre ambos sentidos del delta (ver plan,
  "Decisiones y trade-offs": no crear `addStock`/`reduceStock` separadas).
  Agregar `moveStock` al export final `clienteStockService`.
  - Diferencia con el enunciado: `libro_cliente.isbn` es `NOT NULL` en el
    schema (`src/schemas/libroCliente.schema.ts`), así que el parámetro
    `libro` se amplió a `{ id_libro, isbn, precio }` (no sólo `id_libro,
    precio`) para poder crear la fila la primera vez que un cliente recibe
    ese libro en consignación. Todo `LibroOperacion` que llega a `moverStock`
    ya trae `isbn` resuelto, así que no agrega una query nueva.

## Capa 4: composición por tipo de operación

- [x] T14. Crear `src/services/operacion.config.ts` — parte 1: config
  `venta`. Importar `OperacionConfig`/`LibroOperacion` de
  `./operacion.types`, `libroService`, `createVenta`, `tipoCliente`. Definir:
  - `bodyParser: createVenta`, `esVenta: true`, `filesFolder: "facturas"`.
  - `clientValidation: () => true` (`Venta.clientValidation` actual siempre
    devuelve `true`).
  - `resolverLibros`: por cada `{isbn, cantidad}` del body, `libroService.findOne(isbn,
    userId)` y arma `LibroOperacion` con precio/stock **actuales** del libro
    (`librosTable`) — reemplaza `VentaFirme`'s `setLibros` heredado de
    `Transaccion.setLibros`.
  - `moverStock`: por cada libro, `libroService.moveStock(id_libro,
    -cantidad, tx)` — reemplaza `VentaFirme.stockMovement`.
  - `generarComprobante`: si `cliente.tipo !== tipoCliente.negro`, resuelve
    `getAfipClient(user)` (necesita el `User` completo — ver T19, el
    controller se lo pasa al armar `ComprobanteCtx` o `generarComprobante`
    recibe `user` como argumento extra; documentar acá la decisión final si
    difiere de lo enunciado), llama `facturar(user.punto_venta, venta,
    cliente, afip)` + `emitirComprobante({data: {venta, libros, cliente,
    comprobante}, user})`; si `cliente.tipo === 'negro'`, no hace nada
    (mismo `if` que hoy en `venta.controller.ts#vender`).

- [x] T15. En `src/services/operacion.config.ts` — parte 2: config
  `consignacion`. Definir:
  - `bodyParser: createTransaccion`, `esVenta: false`, `filesFolder:
    "remitos"`.
  - `clientValidation: (tipo) => tipo === tipoCliente.inscripto` (mismo
    chequeo que `Consignacion.clientValidation` actual).
  - `resolverLibros`: igual que `venta` (precio/stock **actuales** del
    libro vía `libroService.findOne`) — reemplaza
    `Transaccion.setLibros` (heredado sin override en `Consignacion`).
  - `moverStock`: `libroService.moveStock(id_libro, -cantidad, tx)` +
    `clienteStockService.moveStock(cliente.id, {id_libro, precio},
    +cantidad, tx)` por libro — reemplaza `Consignacion.stockMovement`.
  - `generarComprobante`: siempre `emitirComprobante({data: {consignacion:
    transaction, cliente, libros}, user})` (remito) — reemplaza
    `Consignacion.comprobante`.

- [x] T16. En `src/services/operacion.config.ts` — parte 3: config
  `ventaConsignacion`. Definir:
  - `bodyParser: createVentaConsignado`, `esVenta: true`, `filesFolder:
    "facturas"`.
  - `clientValidation: (tipo) => tipo === tipoCliente.inscripto` (mismo
    chequeo que `VentaConsignado.clientValidation`).
  - `resolverLibros(libros, cliente, userId, args)`: llama
    `clienteStockService.getStock(cliente.id, userId, args.fecha)` (precio
    **histórico** a `args.fecha`) y `clienteStockService.getStock(cliente.id,
    userId)` (stock **actual**, sin fecha) — dos llamadas, ver plan "Enfoque
    técnico"/"Decisiones y trade-offs" para por qué no se agrega una tercera
    función a `clienteStockService` sólo para este caso — y arma
    `LibroOperacion[]` mergeando por `isbn`: precio del resultado con fecha,
    stock del resultado sin fecha. Si un isbn pedido no aparece en el
    resultado de stock actual (cliente nunca tuvo ese libro en consignación,
    `libro_cliente` sin fila), tratarlo como `stock: 0` (mismo criterio de
    error "no tiene stock suficiente" que si existiera con stock 0, ver
    plan, caso borde no cubierto por el spec).
  - `moverStock`: sólo `clienteStockService.moveStock(cliente.id, {id_libro,
    precio}, -cantidad, tx)` por libro — **no** toca `librosTable.stock`
    (spec: "no el stock general del libro") — reemplaza
    `VentaConsignado.stockMovement`.
  - `generarComprobante`: mismo comportamiento que `venta` (T14): factura si
    `cliente.tipo !== 'negro'`, nada si `'negro'`.

- [x] T17. En `src/services/operacion.config.ts` — parte 4: config
  `devolucion`. Definir:
  - `bodyParser: createTransaccion`, `esVenta: false`, `filesFolder: ""`
    (nunca genera archivo, ver abajo).
  - `clientValidation: (tipo) => tipo === tipoCliente.inscripto` (mismo
    chequeo que `Devolucion.clientValidation`).
  - `resolverLibros`: precio y stock **actuales** del cliente vía
    `clienteStockService.getStock(cliente.id, userId)` (sin fecha) — mismo
    caso borde de "isbn ausente → stock 0" que en T16 — reemplaza
    `Devolucion.setLibros` (hoy `stockDeClienteNoMigrado()`).
  - `moverStock`: `libroService.moveStock(id_libro, +cantidad, tx)` +
    `clienteStockService.moveStock(cliente.id, {id_libro, precio},
    -cantidad, tx)` por libro — reemplaza `Devolucion.stockMovement`.
  - `generarComprobante: null` — no genera comprobante; el `file_path: ""`
    fijo se resuelve al insertar la transacción de tipo `devolucion` en el
    controller genérico (T19), no acá.

- [x] T18. En `src/services/operacion.config.ts` — parte 5: ensamblar y
  exportar `export const operacionConfig: Record<TipoTransaccion,
  OperacionConfig> = { venta, consignacion, ventaConsignacion, devolucion }`
  con las cuatro configs de T14-T17. Correr `npx tsc --noEmit` sobre este
  archivo solo (o el proyecto entero) y confirmar que compila contra el tipo
  `OperacionConfig` de T7 (todas las propiedades requeridas, sólo
  `generarComprobante` nullable).

## Capa 5: controller + routes

- [x] T19. Reescribir `src/controllers/transaccion.controller.ts` completo:
  sacar los imports de `Transaccion`/`LibroTransaccion` (modelo MySQL,
  `../models/transaccion.model`), `User` (modelo MySQL,
  `../models/user.model`), `createTransaccion` (ahora es el `bodyParser` de
  cada `OperacionConfig`, no se importa suelto acá), `conn` (MySQL). Exportar
  tres factories genéricas parametrizadas por `config: OperacionConfig`:
  - `listarOperaciones(config)`: handler que llama
    `transaccionService.getAll(config.tipo, res.locals.user.id)`, resuelve
    `buildFileUrl` sobre cada fila y responde el array — reemplaza `getAll`.
  - `obtenerOperacion(config)`: handler que parsea `id` de `req.params`
    (mismo chequeo `!id` → `ValidationError` que hoy), llama
    `transaccionService.getById(id, userId)` +
    `transaccionService.getLibros(id)`, resuelve `buildFileUrl` y responde
    `{...transaction, libros}` — reemplaza `getOne`. Si `config.esVenta`,
    además hace `ventaService.getById(id, userId)` y mergea sus campos
    (`descuento`, `total`, `medio_pago`, `tipo_cbte`) en la respuesta.
  - `crearOperacion(config)`: handler que reemplaza tanto `transaccion()`
    (viejo, genérico) como `vender`/`ventaConsignado` (`venta.controller.ts`,
    T21): resuelve `userService.findOne({id: res.locals.user.id})` (Postgres,
    reemplaza `User.getById`), parsea `config.bodyParser.parse(req.body)`,
    resuelve `clienteService.findOne({id: body.cliente, user: user.id})`,
    valida `config.clientValidation(cliente.tipo!)` (mismo mensaje de error
    que hoy: `"No se le puede hacer una ${config.tipo} a un cliente de tipo
    ${cliente.tipo}"`), resuelve `config.resolverLibros(body.libros, cliente,
    user.id, {fecha: body.fecha_venta})`, valida stock (`stock < cantidad` →
    `ValidationError`, función compartida entre las cuatro operaciones, no
    repetida — ver plan "Enfoque técnico"), y si `config.esVenta` valida
    `user.punto_venta` (mismo chequeo que hoy en `vender`/`ventaConsignado`).
    Dentro de un único `db.transaction(async (tx) => {...})` (reemplaza
    `connection.beginTransaction()`/`commit()`/`rollback()` manual de
    `mysql2`, sin `connection.release()` explícito en ningún punto, ver plan
    "Enfoque técnico" sobre el bug de `release()` triplicado que deja de
    existir): inserta la transacción
    (`transaccionService.insert`, con `file_path: config.tipo === 'devolucion'
    ? "" : generateClientPath(cliente.razon_social)`), guarda los libros
    (`transaccionService.saveLibros`), si `config.esVenta` inserta la venta
    (`ventaService.insert` con `total: ventaService.calcTotal(libros,
    body.descuento)`), mueve el stock (`config.moverStock`), y si
    `config.generarComprobante` no es `null` lo llama con el `ComprobanteCtx`
    armado (`transaction`, `venta` o `null`, `libros`, `cliente`, `user`) —
    **dentro** de la misma `tx` (spec: todo-o-nada incluyendo el
    comprobante, ver plan). Responde 201 con `{success: true, message:
    "Se realizó la ${config.tipo} correctamente", data: {...transaction,
    file_path: buildFileUrl(...)}}`.
  - Exportar `export default { listarOperaciones, obtenerOperacion,
    crearOperacion }`.

- [x] T20. Reescribir `src/routes/transaccion.routes.ts`: sacar el import de
  `VentaController`/`VentaFirme`/`Venta`/`VentaConsignado`/`Consignacion`/
  `Devolucion` (modelos MySQL); importar `operacionConfig` de
  `../services/operacion.config` y `TransaccionController` (default export
  de T19). Reemplazar el `for (const tipo in transacciones)` actual por
  `for (const tipo in operacionConfig)`, registrando en cada iteración `GET
  /:tipo` (`TransaccionController.listarOperaciones`), `GET /:tipo/:id`
  (`TransaccionController.obtenerOperacion`) y `POST /:tipo`
  (`TransaccionController.crearOperacion`) — a diferencia de hoy, ya no hace
  falta separar el `POST` de `venta`/`ventaConsignacion` a mano (spec:
  mismos paths/verbos observables, `POST /venta` y `POST /ventaConsignacion`
  siguen andando, ahora desde el mismo bucle). Verificar con `curl`/grep que
  las cuatro rutas por tipo quedan registradas (`venta`, `consignacion`,
  `ventaConsignacion`, `devolucion` × 3 verbos = 12 rutas).

- [x] T21. Borrar `src/controllers/venta.controller.ts` por completo (sus
  handlers `vender`/`ventaConsignado` quedan cubiertos por
  `crearOperacion`/`operacionConfig`, ver T19-T20 y plan "Enfoque técnico").
  Confirmar por grep que ningún archivo sigue importando
  `../controllers/venta.controller` (si aparece alguno no cubierto por T20,
  resolverlo ahí).

## Capa 6: ripple en `comprobante`/`Afip`

- [x] T22. En `src/comprobantes/comprobante.ts`: reemplazar `import { Venta }
  from '../models/venta.model'` por
  `import { VentaRow } from '../validators/venta.validator'` y `import {
  Consignacion } from '../models/transaccion.model'`/`import {
  LibroTransaccion, Transaccion } from '../models/transaccion.model'` por
  `import { TransaccionConCliente, LibroOperacion } from
  '../services/operacion.types'` (o `../services/operacion.config` según
  donde termine viviendo el tipo exportado, ver T7); `import { User } from
  '../models/user.model'` por `import { User } from
  '../validators/user.validator'`. Actualizar los tipos `CreateFactura`/
  `CreateRemito` (`venta: VentaRow`, `consignacion: TransaccionConCliente`,
  `libros: LibroOperacion[]`) y las referencias a `Venta.filesFolder`/
  `Consignacion.filesFolder` (ya no existen como propiedades estáticas de
  clase) por el `filesFolder` de la `OperacionConfig` correspondiente,
  pasado como parte de los datos que ya recibe `emitirComprobante` (ajustar
  la firma de `emitirComprobante`/`CreateFactura`/`CreateRemito` si hace
  falta agregar `filesFolder` explícito — documentar la decisión tomada acá
  si difiere de lo enunciado). Sin cambios de lógica: sigue leyendo sólo
  campos (`file_path`, `descuento`, `total`, `medio_pago`, `tipo_cbte`,
  `isbn`, `titulo`, `cantidad`, `precio`), nunca métodos de instancia.
  - Diferencia con el enunciado: `CreateFactura` se amplió con
    `transaction: TransaccionConCliente` (además de `venta: VentaRow`):
    `file_path` vive en `transaccionesTable`, no en `ventasTable`
    (`ventas.schema.ts` no tiene esa columna), así que ya no se puede leer
    `data.venta.file_path` como hacía el `Venta` (MySQL) que mezclaba ambas
    tablas en una sola instancia. `filesFolder` se agregó a `CreateFactura`/
    `CreateRemito` explícito, como preveía el enunciado.

- [x] T23. En `src/afip/Afip.ts`: reemplazar `import { Venta } from
  '../models/venta.model'` por `import { VentaRow } from
  '../validators/venta.validator'` y `import { User } from
  '../models/user.model'` por `import { User } from
  '../validators/user.validator'` (`Client as Cliente` ya apunta a
  `cliente.validator.ts` desde 004, no se toca). Cambiar la firma de
  `facturar(pto_venta: number, venta: Venta, cliente: Cliente, afip: IAfip)`
  a `venta: VentaRow`; `createCSR(user: Pick<User, 'cuit' | 'razon_social'>)`
  y el resto de funciones que reciben `User` siguen compilando porque el
  tipo `User` de `user.validator.ts` (`userValidator.select`, sin
  `password`) ya expone `cuit`, `razon_social`, `production`, `punto_venta`,
  `username`, `fecha_inicio`, `domicilio`, `cond_fiscal`, `email`,
  `ingresos_brutos` (ver `user.service.ts#selectWithoutPassword`) —
  confirmar con `npx tsc --noEmit` que no falta ningún campo que sí tenía la
  clase `User` vieja. Sin cambios de lógica.
  - Diferencia con el enunciado: `usersTable.production` es `boolean`
    (migrado en 001), no el `number` (0/1) que tenía la clase `User` vieja
    (MySQL). `user.production == 1` (comparación floja) seguía funcionando
    por coerción de JS, pero `user.production === 1` (línea 118, comparación
    estricta) siempre daba `false` con un booleano, apagando `production` del
    cliente AFIP sin importar el valor real — si fuera "sin cambios de
    lógica" literal, esto rompería el comportamiento observable, así que se
    corrigió a `user.production` / `user.production === true` para preservar
    la intención original (no es un cambio de lógica de negocio, es la
    corrección mecánica que exige el cambio de tipo `number`→`boolean`).

## Capa 7: baja de los modelos viejos

- [x] T24. Borrar `src/models/transaccion.model.ts` por completo. Confirmar
  por grep que no queda ninguna referencia a
  `../models/transaccion.model`/`./transaccion.model` fuera de lo ya resuelto
  en T19-T23 (si aparece alguna, resolverla con el mismo criterio: tipo →
  `TransaccionConCliente`/`LibroOperacion` de `operacion.types.ts`, valor →
  `transaccionService`).

- [x] T25. Borrar `src/models/venta.model.ts` por completo. Confirmar por
  grep que no queda ninguna referencia a `../models/venta.model`/
  `./venta.model` fuera de lo ya resuelto en T19-T23 (tipo → `VentaRow` de
  `venta.validator.ts`, valor → `ventaService`).

- [x] T26. Borrar `src/models/user.model.ts` por completo (huérfano
  descubierto en este feature, ver plan "Hallazgo previo": sólo lo
  importaban `transaccion.controller.ts`, `venta.controller.ts`,
  `comprobantes/comprobante.ts`, `afip/Afip.ts`, `models/transaccion.model.ts`,
  `models/venta.model.ts` y `test/afip.test.ts`, todos ya resueltos en
  T19-T25 salvo el test, ver T30). Confirmar por grep que no queda ninguna
  referencia a `../models/user.model`/`./user.model` (`middleware/auth.ts`
  usa `TokenUser` de `validators/user.validator.ts`, no la clase `User`, así
  que no debería aparecer).

- [x] T27. Correr `npx tsc --noEmit` sobre el proyecto completo y resolver
  cualquier error de compilación remanente no cubierto por T3-T26. No debe
  quedar ninguna referencia rota a los tres archivos borrados en T24-T26.

## Capa 8: tests

- [x] T28. Reescribir `test/venta.test.ts` contra Postgres/endpoints nuevos
  (seguir el patrón de `test/cliente.test.ts`: `dotenv`, `DB_NAME =
  "epublit_test"`, login, setup/teardown contra `db`/tablas Postgres en vez
  de `conn`/MySQL). Ajustar el describe `VENTA` a los paths/respuestas de
  `POST /transaccion/venta` vía `operacionConfig.venta`/`crearOperacion`
  (T19), incluyendo el caso de cliente `negro` (sin factura) y el caso con
  cliente inscripto (factura vía AFIP mockeado, igual que hoy). Mantener los
  mocks existentes de `../src/afip/afip.js/src/Class/ElectronicBilling` y
  `../src/comprobantes/comprobante`.
  - Diferencia con el enunciado: no se migran datos históricos (spec, "Fuera
    de alcance"), así que se abandonaron los ids de MySQL hardcodeados (40,
    258, cliente 42) del test legado; el test ahora crea sus propios libros
    (isbns dedicados) y usa los clientes por defecto del usuario
    (CONSUMIDOR FINAL para el caso con factura, MOSTRADOR para el caso sin
    factura) en vez de un cliente inscripto ad-hoc, para no depender de
    `getAfipData` real. Ver bloqueador de entorno en "Checkpoint final": no
    se pudo ejecutar para confirmar contra una base real.

- [x] T29. Reescribir `test/consignacion.test.ts` y
  `test/venta_consignacion.test.ts` contra Postgres/endpoints nuevos, mismo
  patrón que T28: el flujo principal de cada archivo (`POST
  /transaccion/consignacion`, `POST /transaccion/ventaConsignacion`) ahora
  sí llega a completarse de punta a punta (a diferencia del estado dejado
  por 004, donde estas dos rutas tiraban `NotImplemented` — ver
  `test/consignacion.test.ts`/`test/venta_consignacion.test.ts` actuales,
  comentario "se recupera cuando venta/transaccion migren"): revertir esos
  comentarios/aserciones de 501 a las aserciones originales (200/201, stock
  descontado del libro y/o `libro_cliente` según el tipo, remito/factura
  emitidos), ajustando el setup de datos (creación de cliente/libros,
  precarga de `libro_cliente`/`precio_libro_cliente` vía `db` de Postgres en
  vez de MySQL) al nuevo esquema.
  - Diferencia con el enunciado: `consignacion.test.ts` crea su propio
    cliente inscripto (mock parcial de `getAfipData` en `../src/afip/Afip`,
    preservando el resto del módulo real) en vez de reusar el cliente 93 de
    MySQL. `venta_consignacion.test.ts` precarga `libro_cliente`/
    `precio_libro_cliente` a mano (mismo patrón que el bloque "Stock
    cliente" de `test/cliente.test.ts`) para poder ejercitar precio
    histórico vs. precio actual. No se pudo ejecutar en este entorno (ver
    "Checkpoint final").

- [x] T30. Ajustar `test/afip.test.ts`: reemplazar `import { User } from
  '../src/models/user.model'` por `import { userService } from
  '../src/services/user.service'`, `import { Venta } from
  '../src/models/venta.model'` por `import { ventaService } from
  '../src/services/venta.service'`, `import { Transaccion } from
  '../src/models/transaccion.model'` por `import { transaccionService } from
  '../src/services/transaccion.service'`. Reemplazar `const user = await
  User.getById(1)` por `const user = await userService.findOne({id: 1})`,
  `const venta = await Venta.getById(38)` por `const venta = await
  ventaService.getById(38, user.id)`, `const transaction = await
  Transaccion.getById(38)` por `const transaction = await
  transaccionService.getById(38, user.id)` (ajustar el id de prueba si el
  38 no existe en la base Postgres de test — documentar el id real usado si
  difiere). El resto del test (llamada a `facturar`, aserciones) no cambia
  de forma.
  - Diferencia con el enunciado: el id 38 no existe en Postgres (no se
    migran datos históricos). En vez de hardcodear otro id fijo, el test
    ahora es autocontenido: loguea, crea un libro y una venta propios vía
    HTTP (mismos mocks de AFIP/comprobante que `venta.test.ts`) y usa el id
    de esa venta recién creada para llamar `facturar` directamente. No se
    pudo ejecutar en este entorno (ver "Checkpoint final").

## Checkpoint final
- [x] `npx tsc --noEmit` sin errores (confirmado, proyecto completo).
- [ ] Tests relevantes corridos (o motivo documentado de por qué no):
  `test/venta.test.ts`, `test/consignacion.test.ts`,
  `test/venta_consignacion.test.ts`, `test/afip.test.ts`, y re-correr
  `test/cliente.test.ts` (T20 de 004 dejó dos tests marcados como 501 que
  ahora deberían volver a su comportamiento original, ver T29).
  - No se pudieron correr en este entorno: bloqueadores de entorno
    preexistentes, no causados por este feature.
    1. `npm test`/`npx vitest` con el Node del sistema (v26.2.0) rompe en el
       arranque: `jsonwebtoken` → `jwa` → `buffer-equal-constant-time` usa
       `Buffer.SlowBuffer`, removido de Node core en v26. Se probó con un
       Node v20.18.1 portable (sin tocar el sistema): rompe distinto,
       `vitest` 5 no puede cargar `vitest.config.ts` en ese Node
       (`ERR_REQUIRE_ESM` en `std-env`). Con un Node v22.14.0 portable el
       arranque de `vitest` sí funciona y `jsonwebtoken` carga bien, pero
       aparece un tercer bloqueador: `src/routes/files.routes.ts` (archivo
       no tocado por este feature) usa `fileRouter.use('/*', ...)`, sintaxis
       que la versión de `path-to-regexp` instalada (vía Express 5) ya no
       acepta (`Missing parameter name`), y tira ese error al bootear
       `src/app.ts` — confirmado con `git stash` que este error existe
       también sin ninguno de los cambios de este feature.
    2. Puerto 5432 (Postgres) ya está ocupado en esta máquina por un
       contenedor de otro proyecto (`portalia-db`), así que
       `docker compose up postgresdb` de este repo falla. Se armó una
       Postgres descartable en el puerto 5433 (contenedor aparte, sin tocar
       `docker-compose.yml`) para poder aplicar las migraciones y probar
       manualmente, pero no se llegó a ejecutar la suite completa por el
       bloqueador de `files.routes.ts` de arriba.
    - Ninguno de los tres bloqueadores lo introduce este feature (confirmado
      con `git stash` para el segundo y tercero); son preexistentes al
      estado del repo en esta máquina. Los cuatro test files quedan escritos
      siguiendo el patrón pedido (T28-T30) pero sin verificación de
      ejecución real — recomendable correrlos en un entorno con Node LTS
      (18/20/22 sin el conflicto de `vitest`/`std-env` visto acá) y sin el
      conflicto de puerto de Postgres antes de dar el feature por cerrado.
- [x] Revisado contra CLAUDE.md (DI, DRY, comentarios, responsabilidad
  única): `operacionConfig` es composición (objetos + funciones inyectadas),
  no herencia; `resolverLibros`/`moverStock`/`generarComprobante` son la
  única superficie que varía por tipo de operación, sin lógica de
  movimiento de stock duplicada fuera de `libroService.moveStock`/
  `clienteStockService.moveStock`; `crearOperacion`/`listarOperaciones`/
  `obtenerOperacion` son funciones de una sola responsabilidad cada una,
  sin wrappers que sólo reenvíen.
