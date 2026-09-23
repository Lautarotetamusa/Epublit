# Tasks: Migrar el módulo `cliente` a la nueva arquitectura

Plan de referencia: specs/004-migrar-cliente/plan.md
Spec de referencia: specs/004-migrar-cliente/spec.md
Referencia de forma de archivos: módulos `persona`/`libro` ya migrados
(`src/schemas/personas.schema.ts`, `src/validators/persona.validator.ts`,
`src/filters/persona.filter.ts`, `src/services/persona.service.ts`,
`src/controllers/persona.controller.ts`, `src/services/libro.service.ts`).

Cada tarea es chica, verificable de forma independiente, y en orden de
dependencia. Marcar `[x]` al completarla y agregar una línea con lo que
efectivamente se hizo si difiere del enunciado.

Nota general: `libroClienteTable`/`precioLibroClienteTable`
(`src/schemas/libroCliente.schema.ts`, `src/schemas/precioLibroCliente.schema.ts`)
ya existen tal cual las necesita este feature (ver plan, "Modelo de datos");
ninguna tarea de abajo las toca.

Nota sobre la migración MySQL: el drop de las FKs/trigger/tabla `clientes`
en MySQL **no es parte de este feature** — decisión explícita del usuario:
toda la carpeta `db/migrations/` (MySQL) se va a borrar por completo en una
etapa posterior del proyecto, así que no vale la pena escribir ahora una
migración `_up`/`_down` prolija sólo para `clientes`. La tabla MySQL
`clientes` (y sus tres FKs) siguen existiendo físicamente en la base
después de este feature; sólo dejan de tener código que las use (ver T1-T17
abajo, que sí borran `src/models/cliente.model.ts` y migran todo lo demás a
Postgres). Ver plan, "Capas afectadas" y "Modelo de datos".

## Capa 0: error nuevo

- [x] T1. En `src/models/errors.ts`, agregar la clase `NotImplemented`
  (`extends ApiError`, status `501`), siguiendo el mismo patrón que
  `NotFound`/`Duplicated`/`Forbidden` ya definidas ahí (constructor
  `(message: string)` que llama a `super(501, message, "NotImplemented")`).
  No requiere tocar `handleErrors`: ya cae en la rama genérica
  `if (err instanceof ApiError)`.

## Capa 1: schema + migración Postgres

- [x] T2. Reescribir `src/schemas/clientes.schema.ts`:
  - `id: integer("id").generatedAlwaysAsIdentity().unique()` (deja de ser
    `.primaryKey()` simple; el `.unique()` es necesario porque
    `libroClienteTable.id_cliente`/`precioLibroClienteTable.id_cliente`
    referencian esta columna sola, y Postgres exige unicidad para el FK —
    mismo comentario que ya existe en `personas.schema.ts`).
  - Agregar `deletedAt: timestamp("deleted_at")` nullable (mismo mecanismo
    de soft-delete que `personasTable`/`librosTable`).
  - Envolver la definición de la tabla en la forma de tercer argumento
    (callback de columnas extra) con
    `primaryKey({ columns: [table.id, table.user] })`, igual patrón que
    `personasTable` (importar `timestamp`, `primaryKey` de
    `drizzle-orm/pg-core`).
  - No tocar `clienteTipoEnum` ni el resto de las columnas
    (`nombre`, `email`, `cuit`, `cond_fiscal`, `razon_social`, `domicilio`,
    `tipo`, `user`).

- [x] T3. Generar la migración Postgres: correr `npm run db:generate`
  (drizzle-kit) a partir del cambio de T2 y revisar a mano el SQL resultante
  en `db/migrations_pg/`. A diferencia de la migración de `libros` (feature
  002, tabla vacía), `clientesTable` ya tiene filas reales (los clientes
  MOSTRADOR/CONSUMIDOR FINAL autocreados por `user.service.ts`): confirmar
  que el `DROP CONSTRAINT` de la PK vieja + `ADD PRIMARY KEY (id, user)` +
  `ADD CONSTRAINT ... UNIQUE (id)` no falla contra esos datos (no debería:
  `user` ya es `NOT NULL` en todas las filas y `id` es identity, así que no
  puede haber duplicados de `(id, user)`). Si drizzle-kit no puede resolver
  solo el nombre del constraint de la PK vieja (mismo problema documentado
  en la migración de `libros`, feature 002 T2), corregirlo a mano en el SQL
  generado. No aplicar todavía contra la base compartida (ver Riesgos del
  plan: conviene probar contra una copia de los datos reales primero).
  - Nota de ejecución: en este entorno no fue posible levantar el
    contenedor `postgresdb` del proyecto (puerto 5432 ocupado por otro
    contenedor Postgres no relacionado, ya corriendo en el host) ni por lo
    tanto aplicar/probar esta migración contra una base real. El SQL
    generado y corregido a mano queda en
    `db/migrations_pg/0003_tan_bushwacker.sql`, pendiente de aplicarse y
    validarse contra datos reales antes de mergear (ver checkpoint final).

## Capa 2: validator + filter

- [x] T4. En `src/validators/cliente.validator.ts`, agregar el grupo
  `clienteValidator` (Postgres/Drizzle) sin tocar todavía `tipoCliente`/
  `TipoCliente` (se mantienen, los siguen usando `venta`/`transaccion`, ver
  T11-T12) ni borrar el resto del archivo (eso es T5):
  - `select = createSelectSchema(clientesTable)`.
  - `insert = createInsertSchema(clientesTable).omit({ id: true, user: true,
    deletedAt: true, cond_fiscal: true, razon_social: true, domicilio: true,
    tipo: true })` → sólo `{nombre, email?, cuit}`. Omitir `tipo` es la
    forma de que "enviar `tipo` en el body no tiene efecto" (spec, casos
    borde) sea una garantía del schema, no un chequeo a mano.
  - `update = insert.partial()`.
  - `filter = z.object({ user: z.number(), tipo: z.enum(Object.keys(tipoCliente)
    as [TipoCliente]) }).partial()`.
  - `pk = createPkSchema(clientesTable).pick({ id: true })`.
  - `export type Client = z.infer<typeof select>` — el tipo que reemplaza a
    la clase `Cliente` en las firmas de `venta`/`transaccion`/`comprobante`/
    `Afip` (ver T11-T13).
  - Exportar todo junto en `export const clienteValidator = { select, insert,
    update, filter, pk }`, mismo patrón que `personaValidator`.

- [x] T5. En `src/validators/cliente.validator.ts`, borrar el bloque viejo
  específico de MySQL que después de T4 ya no usa nadie: `baseSchema`,
  `clienteSchema`, `ClienteSchema`, `SaveClienteInscripto`, `updateCliente`,
  `UpdateCliente`, `createCliente`, `CreateCliente`, `LibroClienteSchema`,
  `StockCliente` (confirmado por grep: sólo los usan
  `src/models/cliente.model.ts` y `src/controllers/cliente.controller.ts`
  viejos, que se reescriben/borran en T9/T14 — si algún otro módulo
  apareciera usándolos al grepear de nuevo en este punto, no borrarlo y
  documentarlo acá). Mantener `tipoCliente`/`TipoCliente` (siguen siendo
  consumidos por `venta.model.ts`, `transaccion.model.ts`,
  `venta.controller.ts`, `transaccion.controller.ts` y varios tests) y el
  import de `afipSchema` sólo si sigue haciendo falta para algo — si queda
  sin uso tras este borrado, sacarlo también.

- [x] T6. Crear `src/filters/cliente.filter.ts` con `clienteFilterMap:
  FilterMap<typeof clienteValidator.filter>`: `user: (val) =>
  eq(clientesTable.user, val)`, `tipo: (val) => eq(clientesTable.tipo, val)`.
  Mismo patrón que `src/filters/libro.filter.ts`.

## Capa 3: services

- [x] T7. Crear `src/services/cliente.service.ts` — parte 1 (CRUD base +
  `generateClientPath`):
  - `builder = new ServiceBuilder(db, clientesTable, clienteFilterMap)`.
  - `findOne = builder.findOne()` (PK compuesta `(id, user)`: tira
    `NotFound` si el cliente no existe o es de otro usuario, sin chequeo
    manual — mismo comentario que ya existe en `persona.service.ts`).
  - `findAllRaw = builder.findAll(false)` con un `select` custom
    (`() => db.select().from(clientesTable).orderBy(clientesTable.nombre).$dynamic()`)
    para preservar el `ORDER BY nombre ASC` del `Cliente.getAll` actual
    (mismo patrón que `selectOrderedByTitulo` en `libro.service.ts`).
    `findAll = async (userId: number, tipo?: TipoCliente) =>
    findAllRaw({ user: userId, ...(tipo ? { tipo } : {}) })`.
  - Mover `generateClientPath` tal cual desde `src/models/cliente.model.ts`
    (función pura, sin dependencia de MySQL) y exportarla desde este
    service.
  - Exportar por ahora `{ findOne, findAll, generateClientPath }` en
    `clienteService` (se completa en T8-T9).

- [x] T8. En `src/services/cliente.service.ts` — parte 2 (`existsByCuit`,
  `create`):
  - `existsByCuit(cuit: string, userId: number): Promise<boolean>`: select
    de `clientesTable` filtrando `cuit`, `user = userId`, `tipo =
    tipoCliente.inscripto`, `isNull(deletedAt)`, `limit(1)` — mismo alcance
    que `Cliente.cuilExists` (sólo importa duplicado entre inscriptos, un
    particular/negro nunca tiene cuit propio).
  - `create(body: ClienteInsert, userId: number): Promise<Client>`: llama
    `getAfipData(body.cuit)` (`../afip/Afip`) y hace
    `builder.create()({ ...body, cond_fiscal: afipData.cond_fiscal,
    razon_social: afipData.razon_social, domicilio: afipData.domicilio,
    user: userId, tipo: tipoCliente.inscripto })` — forzar
    `tipo: "inscripto"` acá (no en el controller) replica
    `Cliente.insert` actual ("no se puede crear un cliente que no sea
    inscripto").
  - Agregar `create = builder.create()` como función interna del builder
    antes de envolverla en la función de dominio de arriba (mismo patrón
    que `libro.service.ts` con `update`/`updateLibro`: la función expuesta
    en `clienteService` es la de dominio, no el `create` crudo del
    builder).

- [x] T9. En `src/services/cliente.service.ts` — parte 3 (`update`,
  `remove`) y export final:
  - `update(id: number, userId: number, body: ClienteUpdate): Promise<Client>`:
    resuelve `const cliente = await findOne({id, user: userId})`; si
    `cliente.tipo === tipoCliente.particular` → `throw new
    ValidationError("No se puede actualizar un cliente CONSUMIDOR FINAL")`
    (replica `Cliente.update` actual); si `body.cuit && body.cuit !==
    cliente.cuit`, re-consulta `getAfipData(body.cuit)` y mergea
    `cond_fiscal`/`razon_social`/`domicilio` nuevos en el `body` antes de
    aplicarlo; llama al `update` crudo del builder
    (`builder.update()({id, user: userId}, body)`) y devuelve el resultado.
  - `remove(id: number, userId: number): Promise<void>`: resuelve
    `const cliente = await findOne({id, user: userId})`; si `cliente.tipo
    === tipoCliente.particular || cliente.tipo === tipoCliente.negro` →
    `throw new ValidationError(...)` (bloquea tanto CONSUMIDOR FINAL como
    MOSTRADOR, chequeando sólo `tipo` — ver plan, "Decisiones y
    trade-offs": hoy son equivalentes porque `create` siempre fuerza
    `tipo: "inscripto"`); si no, `await builder.delete()({id, user: userId})`
    (soft delete vía `deletedAt`).
  - Exportar `clienteService = { findOne, findAll, existsByCuit, create,
    update, remove, generateClientPath }`.

- [x] T10. Crear `src/services/clienteStock.service.ts`:
  - `getStock(clienteId: number, userId: number, fecha?: Date)`: primero
    `const cliente = await clienteService.findOne({id: clienteId, user:
    userId})` (tira `NotFound` si no existe/no es propio, sin chequeo
    aparte). Si `fecha === undefined`: select de `libroClienteTable` +
    join `librosTable` (`titulo, id_libro, isbn, precio: libroClienteTable.precio,
    stock`) filtrado por `id_cliente = cliente.id`, `ORDER BY titulo ASC`
    (equivalente al `getLibros` sin fecha actual). Si `fecha` está
    definida: replica la subquery de "último precio vigente antes de
    `fecha`" del `Cliente.getLibros` actual sobre `precioLibroClienteTable`
    (agrupado por `id_libro`, `MAX(created_at)` con
    `created_at <= fecha + interval '3 hours'` — ver plan, "Decisiones y
    trade-offs", para por qué es `+3h` sobre el input y no `-3h` sobre cada
    fila) joineado con `libroClienteTable` (para el `stock` vigente, que no
    tiene historial) y `librosTable` (para `titulo`), todo filtrado por
    `id_cliente = cliente.id`.
  - `syncPrecios(clienteId: number, userId: number)`: resuelve
    `cliente` igual que `getStock`; dentro de una única `db.transaction`,
    1) inserta en `precioLibroClienteTable` una fila por cada
    `(id_libro, id_cliente)` de `libroClienteTable` cuyo `precio` difiera
    del `librosTable.precio` vigente para ese `id_libro`, con el precio
    *nuevo* del libro (ver plan: se preserva la semántica actual de grabar
    el precio nuevo con el timestamp de "ahora", no el precio anterior);
    2) actualiza `libroClienteTable.precio` a `librosTable.precio` para esas
    mismas filas. A diferencia del `Cliente.updatePrecios` actual, **no
    lanza** si ningún precio estaba desactualizado (corrige el bug de
    `NothingChanged`, ver plan): si el `UPDATE`/`INSERT` no afecta filas,
    simplemente no pasa nada. Devuelve `await getStock(clienteId, userId)`
    al final, siempre.
  - Exportar `clienteStockService = { getStock, syncPrecios }`.

## Capa 4: controller + routes

- [x] T11. Reescribir `src/controllers/cliente.controller.ts` completo
  sobre `clienteService`/`clienteStockService`/`clienteValidator`, sacando
  los imports de `Cliente` (modelo MySQL) y `createCliente`/`updateCliente`
  (validators viejos borrados en T5):
  - `create`: `const body = clienteValidator.insert.parse(req.body)`; si
    `body.cuit === res.locals.user.cuit` → `throw new
    ValidationError("No podes cargarte a vos mismo como cliente")` (replica
    el chequeo actual); si `await clienteService.existsByCuit(body.cuit,
    userId)` → `throw new Duplicated(...)`; llama
    `clienteService.create(body, userId)`; responde 201.
  - `update`: `const {id} = clienteValidator.pk.parse(req.params)`; `const
    body = clienteValidator.update.parse(req.body)`; resuelve
    `const cliente = await clienteService.findOne({id, user: userId})` para
    el chequeo de cuit duplicado (`body.cuit && body.cuit !== cliente.cuit
    && await clienteService.existsByCuit(...)` → `Duplicated`, mismo patrón
    que `persona.controller.ts#update`); llama
    `clienteService.update(id, userId, body)`; responde 201.
  - `delet`: `const {id} = clienteValidator.pk.parse(req.params)`; llama
    `clienteService.remove(id, userId)`; responde 200.
  - `getAll`: parsea `clienteValidator.filter.pick({tipo: true}).parse(req.query)`
    (o equivalente que tolere `tipo` ausente) y llama
    `clienteService.findAll(userId, tipo)`; responde con el array.
  - `getOne`: `const {id} = clienteValidator.pk.parse(req.params)`; llama
    `clienteService.findOne({id, user: userId})`; responde con el cliente.
  - `getStock`: parsea `pk` de params y `{fecha: z.coerce.date().optional()}`
    de query; llama `clienteStockService.getStock(id, userId, fecha)`;
    responde con el array de libros.
  - `updatePrecios`: parsea `pk` de params; llama
    `clienteStockService.syncPrecios(id, userId)`; responde 200 con
    `{success: true, message: ..., data: libros}`.
  - `getVentas`: **no** parsea nada ni consulta ningún service; el cuerpo
    completo es
    `throw new NotImplemented("GET /cliente/:id/ventas no está migrado; se resuelve junto con venta/transaccion")`
    (ver plan, "Enfoque técnico" — la ruta se mantiene registrada pero sin
    implementación real).
  - Mantener el export default `{ create, update, getStock, updatePrecios,
    getVentas, delet, getAll, getOne }`, mismos nombres que hoy, para no
    tocar `src/routes/cliente.routes.ts` más de lo necesario (ver T12).

- [x] T12. Editar `src/routes/cliente.routes.ts`: quitar la línea
  `router.get('/consumidor_final', ClienteController.getOne);` (spec, "No
  incluye": `GET /cliente/consumidor_final` se elimina, `GET
  /cliente?tipo=particular` ya lo cubre vía `getAll`). No tocar el resto de
  las rutas ni su orden, incluida `router.get('/:id/ventas',
  ClienteController.getVentas)` (se mantiene, apunta al handler 501 de
  T11).

## Capa 5: ripple en `venta`/`transaccion`/`comprobante`/`Afip`

- [x] T13. En `src/models/transaccion.model.ts`: agregar la función
  `function stockDeClienteNoMigrado(): never { throw new NotImplemented("Movimiento de stock de cliente todavía no migrado a Postgres (ver venta/transaccion)"); }`
  (importar `NotImplemented` de T1 junto a `NotFound`/`ValidationError` ya
  importados) y exportarla. Reemplazar:
  - En `Consignacion.stockMovement`: la llamada `await
    cliente.addStock(libros, connection)` por `stockDeClienteNoMigrado()`.
  - En `Devolucion.stockMovement`: la llamada `await
    cliente.reduceStock(libros, connection)` por `stockDeClienteNoMigrado()`.
  - En `Devolucion.setLibros`: la llamada `await
    cliente.getLibros(userId)` (y el uso de `librosCliente` que depende de
    ella) por `stockDeClienteNoMigrado()` al principio del método — el
    resto del cuerpo que dependía de ese resultado queda inalcanzable, no
    hace falta reescribirlo, sólo asegurarse de que compile (p.ej. devolver
    el resultado de `stockDeClienteNoMigrado()` directo, ya que su tipo de
    retorno es `never`).
  - Cambiar el tipo `Cliente` (import de `./cliente.model`) por `Client`
    (import de `../validators/cliente.validator`) en todas las firmas de
    este archivo: `ITransaccion`, `Transaccion.stockMovement`,
    `Transaccion.comprobante`, `Transaccion.clientValidation` (no aplica,
    recibe `TipoCliente` no `Cliente`), `Transaccion.setLibros`,
    `Consignacion.stockMovement`, `Consignacion.comprobante`,
    `Devolucion.setLibros`, `Devolucion.stockMovement`,
    `Devolucion.comprobante`. Sacar el import de `Cliente` de
    `./cliente.model` y agregar el de `Client` de
    `../validators/cliente.validator`.
  - Diferencia con lo enunciado: en `Devolucion.setLibros` no se dejó el
    resto del cuerpo original como código inalcanzable después del
    `throw`/`return stockDeClienteNoMigrado()` — se borró directamente (el
    `for` que usaba `librosCliente`, ya sin esa variable, no compilaba). El
    comportamiento observable es el mismo (siempre tira `NotImplemented`).

- [x] T14. En `src/models/venta.model.ts`: cambiar el tipo `Cliente`
  (import de `./cliente.model`) por `Client` (import de
  `../validators/cliente.validator`) en todas las firmas (`Venta.stockValidation`,
  `Venta.clientValidation` no aplica igual que arriba, `Venta.stockMovement`,
  `Venta.comprobante`, `VentaFirme.stockMovement`,
  `VentaConsignado.setLibros`, `VentaConsignado.stockMovement`). Importar
  `stockDeClienteNoMigrado` de `./transaccion.model` (ya importa
  `LibroTransaccion`, `Transaccion` de ahí) y reemplazar:
  - En `VentaConsignado.setLibros`: la llamada `await
    cliente.getLibros(args.date)` (y el uso de `librosCliente` que depende
    de ella) por `stockDeClienteNoMigrado()` al principio del método, mismo
    criterio que `Devolucion.setLibros` en T13.
  - En `VentaConsignado.stockMovement`: la llamada `await
    cliente.reduceStock(libros, connection)` por `stockDeClienteNoMigrado()`.
  Sacar el import de `Cliente` de `./cliente.model`.

- [x] T15. En `src/controllers/venta.controller.ts` y
  `src/controllers/transaccion.controller.ts`: reemplazar
  `import { Cliente, generateClientPath } from "../models/cliente.model"`
  por `import { generateClientPath } from "../services/cliente.service"` y
  agregar `import { Client } from "../validators/cliente.validator"` sólo
  si hace falta tipar algo explícitamente (revisar; probablemente no hace
  falta porque el resultado de `clienteService.findOne` ya viene tipado).
  Reemplazar cada `await Cliente.getById(<id>, user.id)` por `await
  clienteService.findOne({id: <id>, user: user.id})` (importar
  `clienteService` de `../services/cliente.service`) — en
  `venta.controller.ts` hay dos call sites (`ventaConsignado`, `vender`),
  en `transaccion.controller.ts` uno (`transaccion`). No tocar ningún otro
  comportamiento de estos controllers (siguen sobre MySQL/`conn` para todo
  lo demás).

- [x] T16. En `src/comprobantes/comprobante.ts` y `src/afip/Afip.ts`:
  reemplazar `import { Cliente } from '../models/cliente.model'` por
  `import { Client as Cliente } from '../validators/cliente.validator'`
  (alias para no renombrar los parámetros `cliente: Cliente` existentes en
  `CreateFactura`/`CreateRemito`/`facturar`). No tocar ninguna otra línea de
  estos dos archivos: sólo leen campos (`razon_social`, `cuit`,
  `cond_fiscal`, `domicilio`) que el tipo `Client` sigue teniendo.

## Capa 6: baja del modelo viejo

- [x] T17. Borrar `src/models/cliente.model.ts` por completo. Correr `npx
  tsc --noEmit` y confirmar que no quedan referencias rotas a
  `../models/cliente.model` en ningún archivo (si aparece alguna no
  cubierta por T13-T16, resolverla ahí mismo siguiendo el mismo criterio:
  tipo → `Client` de `cliente.validator.ts`, valor → `clienteService`/
  `generateClientPath` de `cliente.service.ts`). Nota: la tabla MySQL
  `clientes` y sus FKs no se tocan acá (ver nota general de arriba sobre la
  migración MySQL diferida); esta tarea es sólo baja de código.

## Capa 7: tests

- [x] T18. Reescribir `test/cliente.test.ts` contra Postgres (seguir el
  patrón de `test/persona.test.ts`/`test/libro.test.ts`: `dotenv`, `DB_NAME
  = "epublit_test"`, login, un hard delete inicial contra `db`/`clientesTable`
  en vez de `conn`/MySQL, `afterAll` que cierra `conn`/`server`):
  - Hard delete inicial: borrar de `clientesTable` (Postgres, vía `db`) las
    filas con `cuit = '30710813082'` o `cuit = cuit` (la variable del test)
    para el usuario de test, en vez de las queries MySQL actuales contra
    `clientes`/`libro_cliente`/`precio_libro_cliente`/`transacciones`/
    `libros_transacciones` (esas tablas MySQL siguen existiendo pero ya no
    las usa ningún código de este feature — ver nota general sobre la
    migración MySQL diferida; el stock de este feature vive en
    `libroClienteTable`/`precioLibroClienteTable` de Postgres: limpiar esas
    dos también por `id_cliente` del cliente de test antes de borrar el
    cliente).
  - Sacar el test `'consumidor final'` del describe `GET cliente/` (la ruta
    se eliminó en T12).
  - Cambiar el test `'Obtener ventas de un cliente'` para esperar 501
    (`NotImplemented`) en vez de 200 con un array de ventas (ver T11,
    `getVentas`).
  - `'file paths'` (test de `generateClientPath`): cambiar el import de
    `../src/models/cliente.model` a `../src/services/cliente.service`; la
    función y su comportamiento no cambian.
  - Revisar los describe `POST cliente/`, `GET cliente/`, `PUT cliente/{id}`
    existentes contra el comportamiento nuevo: `DELETE /cliente/:id` ahora
    es soft delete (no había test de `DELETE` en el archivo actual —
    agregar uno que verifique que tras borrar un cliente inscripto,
    `GET /cliente/:id` responde 404 y ya no aparece en `GET /cliente`, y
    que borrar el cliente CONSUMIDOR FINAL/MOSTRADOR de ese usuario
    responde 400 `ValidationError`, no lo borra).
  - Mantener el describe `Stock cliente` tal cual en su forma (sigue
    ejercitando `GET`/`PUT /cliente/:id/stock` contra `POST /consignacion`,
    que en este punto **ya no funciona** porque `Consignacion.stockMovement`
    tira `NotImplemented`, ver T13) — revisar contra T20: probablemente hay
    que reemplazar el setup "realizamos una consignación" por un `INSERT`
    directo en `libroClienteTable`/`precioLibroClienteTable` de Postgres
    dentro del propio test (vía `db`), ya que el único camino que hoy carga
    ese stock (`Consignacion.stockMovement`) queda inutilizado. Documentar
    en el test cuál decisión se tomó si difiere de esto.

- [x] T19. Ajustar `test/afip.test.ts`: reemplazar
  `import { Cliente } from '../src/models/cliente.model'` por
  `import { clienteService } from '../src/services/cliente.service'`, y
  `const cliente = await Cliente.getById(transaction.id_cliente, user.id)`
  por `const cliente = await clienteService.findOne({id:
  transaction.id_cliente, user: user.id})`. No tocar el resto del test
  (`User.getById`, `Venta.getById`, `Transaccion.getById` siguen sobre
  MySQL, no migrados).

- [x] T20. Revisar `test/consignacion.test.ts` y
  `test/venta_consignacion.test.ts` caso por caso contra el nuevo
  comportamiento de `Consignacion.stockMovement`/`VentaConsignado.setLibros`/
  `VentaConsignado.stockMovement` (todos tiran `NotImplemented` desde T13/T14):
  - `test/consignacion.test.ts`: el test que hace `POST /consignacion/` con
    un cliente inscripto (flujo principal del archivo) ahora falla en el
    tramo `Consignacion.stockMovement` → `cliente.addStock` reemplazado; el
    endpoint ya inserta la transacción y los libros de la transacción antes
    de llegar a ese punto (ver `transaccion.controller.ts#transaccion`), así
    que la respuesta pasa a ser un error 501 dentro de un `try/catch` que
    hace `rollback` (revisar en el código real si el rollback deja todo
    limpio). Cambiar la aserción de "consignación creada con éxito" (200/201
    y libros con stock reducido) por "responde 501 `NotImplemented`", y
    sacar/ajustar cualquier aserción posterior que dependiera de que la
    consignación se haya creado de verdad (stock en 0, archivo de remito
    emitido, etc.).
  - `test/venta_consignacion.test.ts`: mismo criterio para `POST
    /venta/consignado` (`VentaConsignado.setLibros` ya tira
    `NotImplemented` antes de llegar a `stockMovement`, así que falla más
    temprano en el flujo, sin llegar a facturar); ajustar la aserción
    principal a "responde 501" y sacar los asserts que dependían de una
    venta consignada real.
  - Documentar en cada archivo, con un comentario breve junto al test
    ajustado, que la causa es la migración de `cliente` (este feature) y
    que el flujo se recupera cuando `venta`/`transaccion` migren (ver plan,
    "Riesgos").

## Checkpoint final
- [x] `npx tsc --noEmit` sin errores (confirmado, sin warnings)
- [ ] Tests relevantes corridos (o motivo documentado de por qué no): **no
  se pudieron correr**. En este entorno de ejecución el puerto 5432 ya está
  ocupado por un contenedor Postgres ajeno a este proyecto (`portalia-db`),
  así que no se pudo levantar `postgresdb` (`docker compose up postgresdb`
  falla por conflicto de puerto) ni aplicar la migración de T3 contra una
  base real. `npx vitest run test/cliente.test.ts` llega a intentar
  conectarse a Postgres y falla en la autenticación (credenciales del
  Postgres ajeno, no las del proyecto) — confirma que el archivo de test
  carga y se ejecuta hasta ese punto, pero no valida el comportamiento
  contra datos reales. Ningún otro test (`afip.test.ts`,
  `consignacion.test.ts`, `venta_consignacion.test.ts`) se pudo correr por
  el mismo motivo. Queda pendiente correr `npm test` completo (o al menos
  `test/cliente.test.ts`, `test/persona.test.ts`, `test/libro.test.ts`,
  `test/afip.test.ts`, `test/consignacion.test.ts`,
  `test/venta_consignacion.test.ts`) en un entorno con acceso real a los
  contenedores del proyecto antes de mergear.
- [x] Revisado contra CLAUDE.md (DI, DRY, comentarios, responsabilidad
  única): services reciben sus dependencias (`db`, filter maps) por
  parámetro vía `ServiceBuilder`, sin herencia; `generateClientPath` se
  reusa desde `venta.controller.ts`/`transaccion.controller.ts` en vez de
  duplicarse; comentarios nuevos explican decisiones no evidentes por el
  nombre (por qué `.unique()`, por qué la ventana GMT-3, por qué
  `NotImplemented` en vez de re-implementar stock); controller/service
  mantienen una responsabilidad cada uno, sin wrappers que sólo reenvíen
  (`clienteService.update`/`remove` encapsulan lógica de dominio real, no
  sólo delegan al builder).
