# Plan: Migrar los módulos `transaccion` y `venta`

## Spec de referencia
specs/005-migrar-transaccion-venta/spec.md

## Hallazgo previo (grep) que confirma que no hace falta el patrón `NotImplemented` de ripple

A diferencia de `cliente` (004), donde `venta`/`transaccion` quedaban sin
migrar y forzaban stubs `NotImplemented`, acá se migran los dos módulos a la
vez. Se confirmó por grep que **ningún módulo fuera de este feature** importa
`src/models/transaccion.model.ts` ni `src/models/venta.model.ts`:

- `transaccion.model.ts`: importado por `venta.model.ts` (se borra junto),
  `venta.controller.ts`/`transaccion.controller.ts` (se reescriben),
  `comprobantes/comprobante.ts`, `routes/transaccion.routes.ts`,
  `test/afip.test.ts` — todos tocados por este feature.
- `venta.model.ts`: importado por `venta.controller.ts`, `afip/Afip.ts`,
  `routes/transaccion.routes.ts`, `comprobantes/comprobante.ts`,
  `test/afip.test.ts` — ídem, todos dentro de este feature.
- `liquidacion.controller.ts` (el único módulo en pausa) **no** importa
  `transaccion.model.ts` ni `venta.model.ts`; importa directamente
  `libro.model.ts`, `persona.model.ts`, `libro_persona.model.ts` y
  `liquidacion.model.ts` (MySQL), sin pasar por `transaccion`/`venta`. Esto
  confirma lo que dice el spec: `liquidacion` no es dependencia bloqueante.

Consecuencia concreta para "Capas afectadas": `src/models/libro.model.ts` y
`src/models/persona.model.ts` (MySQL) **se mantienen intactos**, aunque
`transaccion.model.ts`/`venta.model.ts` los importaban hoy (`Libro.getByIsbn`,
`Libro.updateStock`) — siguen vivos únicamente porque `liquidacion.controller.ts`
los sigue necesitando, no por este feature. No se migran ni se tocan acá.

Hallazgo adicional, no anticipado por el spec: `src/models/user.model.ts`
(clase `User`, MySQL) queda **totalmente huérfano** después de este feature.
Hoy sólo lo importan `transaccion.controller.ts`, `venta.controller.ts`,
`comprobantes/comprobante.ts`, `afip/Afip.ts`, `models/transaccion.model.ts`,
`models/venta.model.ts` y `test/afip.test.ts` — todos se tocan en este
feature y pasan a usar `userService`/`userValidator.select` (Postgres, ya
migrado en 001). `middleware/auth.ts` usa un tipo separado (`TokenUser`,
definido en `validators/user.validator.ts` junto al resto de validators
viejos) y no la clase `User`, así que no depende de `user.model.ts`. Se borra
`src/models/user.model.ts` como consecuencia directa (ver "Decisiones y
trade-offs"), aplicando el mismo criterio "no dejar código muerto" ya usado
con `cliente.model.ts` en 004, aunque el spec de este feature no lo pida
explícitamente.

## Enfoque técnico

### Reemplazo de la jerarquía de herencia por composición (decisión central)

El legado modela cinco variantes de una misma operación (`Transaccion` →
`Consignacion`/`Devolucion`; `Transaccion` → `Venta` → `VentaFirme`/
`VentaConsignado`) sobreescribiendo métodos estáticos/de instancia
(`stockMovement`, `setLibros`, `clientValidation`, `comprobante`,
`stockValidation`). CLAUDE.md exige DI por sobre herencia, así que esta
migración reemplaza la jerarquía por **un objeto de configuración por tipo de
operación**, no por subclases:

```
// forma conceptual, no código final — el detalle exacto es tarea de sdd-task-breakdown
type OperacionConfig = {
    tipo: TipoTransaccion;
    filesFolder: string;
    esVenta: boolean;                 // inserta también en ventasTable
    bodyParser: ZodSchema;            // createTransaccion | createVenta | createVentaConsignado
    clientValidation: (tipo: TipoCliente) => boolean;
    resolverLibros: (libros, cliente, userId, args?) => Promise<LibroOperacion[]>;
    moverStock: (libros: LibroOperacion[], cliente: Client, tx) => Promise<void>;
    generarComprobante: ((ctx: ComprobanteCtx) => Promise<void>) | null;
};
```

Un único archivo nuevo, `src/services/operacion.config.ts`, arma las cuatro
instancias (`venta`, `ventaConsignacion`, `consignacion`, `devolucion`)
componiendo funciones ya existentes o nuevas de `libroService`,
`clienteStockService`, `ventaService`, `comprobante.ts` y `Afip.ts` — nunca
subclases. El controller y el router quedan parametrizados por esa
configuración (una función, un `Record<TipoTransaccion, OperacionConfig>`),
igual que hoy el router itera un `Record` de clases (`transacciones` map en
`transaccion.routes.ts`) pero sin necesitar que cada "clase" repita/sobreescriba
comportamiento común.

Se gana: cada variante es datos + funciones inyectadas, testeable en
aislamiento sin instanciar una jerarquía completa; agregar una quinta
operación en el futuro es agregar una entrada al `Record`, no una subclase
nueva con métodos a sobreescribir correctamente. Se pierde: se pierde el
polimorfismo "gratis" de TypeScript sobre una clase abstracta (el compilador
ya no fuerza que una subclase nueva implemente todos los métodos); se
compensa tipando `OperacionConfig` como objeto completo obligatorio (todas
las propiedades requeridas salvo `generarComprobante`, explícitamente
nullable sólo para `devolucion`).

### División de servicios (sin usar `ServiceBuilder` para `transacciones`/`ventas`)

A diferencia de `cliente`/`libro`/`persona` (dueño simple vía PK compuesta +
CRUD por bradb), toda lectura de `transacciones`/`ventas` necesita un JOIN con
`clientesTable` (para nombre/cuit/cond_fiscal/tipo, pedido por el spec) y toda
escritura es un paso dentro de una transacción más larga (transacción +
detalle de libros + movimiento de stock + comprobante). `ServiceBuilder.findAll`/
`findOne` no cubren eso sin un `select` custom que igual requiere reescribir
el JOIN a mano, y `ServiceBuilder.create`/`update` no ganan nada frente a un
`tx.insert(...).returning()` directo cuando cada escritura ya vive dentro de
un `db.transaction()` armado a mano. Se sigue el mismo patrón que
`libroPersonaService`/`clienteStockService` (que tampoco usan `ServiceBuilder`
para las tablas sin necesidad real de su CRUD genérico): funciones explícitas
sobre `db`/`tx` con Drizzle.

- `src/services/transaccion.service.ts`: `insert` (dentro de una `tx` dada),
  `saveLibros` (bulk insert en `librosTransaccionesTable`), `getAll(tipo,
  userId)` y `getById(id, userId)` (JOIN `transacciones` + `clientes`,
  ordenado por `id DESC`, con chequeo de dueño vía `WHERE user = ?` — mismo
  efecto que la PK compuesta pero expresado en el propio JOIN, ver "Modelo de
  datos" para por qué igual se ajusta la PK), `getLibros(idTransaccion)`
  (JOIN `libros_transacciones` + `libros`), y `buildFileUrl(fileName, folder)`
  (reemplaza el método de instancia `Transaccion.parsePath`, ahora una función
  pura sin estado).
- `src/services/venta.service.ts`: `insert` (inserta la fila de `ventas`
  dentro de la misma `tx`, referenciando la transacción ya creada),
  `getAll(tipo, userId)`/`getById(id, userId)` (JOIN `ventas` + `transacciones`
  + `clientes`, sólo para `type IN (venta, ventaConsignacion)`), `calcTotal`
  (la misma función pura que `Venta.calcTotal` hoy, sin cambios de lógica).
- `src/services/libro.service.ts` (ampliado): se agrega `moveStock(idLibro,
  delta, tx?)`, reemplazo de `Libro.updateStock` (MySQL) que no tiene hoy
  equivalente en Postgres (confirmado por el spec, "Datos existentes"). Hace
  `UPDATE libros SET stock = stock + delta WHERE id_libro = ?` (incremento
  atómico expresado en SQL, no lectura-modificación-escritura en JS, para no
  perder actualizaciones concurrentes) y acepta una `tx` opcional para
  participar de la transacción de la operación.
- `src/services/clienteStock.service.ts` (ampliado): se agrega
  `moveStock(clienteId, libro: {id_libro, precio}, delta, tx?)`, reemplazo de
  `cliente.addStock`/`cliente.reduceStock` (`stockDeClienteNoMigrado()` hoy).
  Usa `INSERT ... ON CONFLICT (id_libro, id_cliente) DO UPDATE SET stock =
  libro_cliente.stock + excluded.stock` (upsert): una consignación puede ser
  la primera vez que ese cliente recibe ese libro (no existe fila en
  `libro_cliente` todavía), así que hace falta poder crear la fila con el
  precio *actual* del libro (`libro.precio`, resuelto por quien llama) en el
  mismo paso que incrementa/decrementa. Una reducción de stock (venta en
  consignación, devolución) nunca dispara la rama de creación en la práctica,
  porque `resolverLibros` de esos dos tipos ya valida que exista stock antes
  de llegar acá — pero el `upsert` es el mecanismo único para ambos sentidos,
  no dos funciones separadas, para no duplicar la lógica de "sumar delta".

### Resolución de libros por tipo de operación (`resolverLibros`)

Reemplaza `Transaccion.setLibros`/`Venta.setLibros` (y sus overrides). Cuatro
implementaciones, cada una devolviendo el mismo shape `LibroOperacion[]`
(`{id_libro, isbn, titulo, cantidad, precio, stock}`, tipo nuevo en
`src/services/operacion.types.ts`) para que la validación de stock
(`stock < cantidad` → `ValidationError`) sea una única función compartida,
sin importar el origen del dato:

- `venta`/`consignacion`: `libroService.findOne` + precio/stock **actuales**
  del libro (`librosTable`).
- `ventaConsignacion`: precio **histórico** del cliente a `fecha_venta`
  (`clienteStockService`'s `getStockAFecha`, ver debajo) pero stock **actual**
  del cliente (`getStockActual`) — no tiene sentido validar contra el stock
  que el cliente tenía en el pasado si lo que se va a descontar es inventario
  presente. `clienteStockService.getStock(clienteId, userId, fecha)` hoy sólo
  devuelve un conjunto u otro según si `fecha` está presente, nunca los dos
  combinados; `resolverLibros` de `ventaConsignacion` llama `getStock` dos
  veces (una con `fecha`, otra sin) y arma el merge por `isbn` en la capa de
  `operacion.config.ts`. Es una query extra por request; se documenta como
  trade-off aceptado por no tocar la firma ya usada de `clienteStockService`
  (que sigue sirviendo a `GET /cliente/:id/stock` tal cual) sólo para este
  caso de uso puntual.
- `devolucion`: precio y stock **actuales** del cliente (`getStockActual`,
  sin `fecha` — ver "Decisiones confirmadas" del spec: precio = el mismo que
  devuelve `clienteStockService.getStock` sin fecha).

Caso borde no cubierto explícitamente por el spec pero que aparece al migrar:
si el cliente nunca tuvo ese libro en consignación (no existe fila en
`libro_cliente`), `getStockActual`/`getStockAFecha` (ambas hacen `INNER JOIN
libro_cliente`) no devuelven esa fila. `resolverLibros` de
`ventaConsignacion`/`devolucion` trata "isbn pedido pero ausente en el
resultado" como `stock: 0` (mismo error de "no tiene stock suficiente" que
si existiera con `stock: 0`), en vez de lanzar un error distinto o un 500 por
acceso a `undefined`.

### Movimiento de stock por tipo de operación (`moverStock`)

Reemplaza `stockMovement`. Compone `libroService.moveStock`/
`clienteStockService.moveStock` sin nunca escribir SQL de movimiento de stock
por fuera de esos dos puntos:

- `venta`: `libroService.moveStock(id_libro, -cantidad, tx)` por libro.
- `consignacion`: `libroService.moveStock(id_libro, -cantidad, tx)` +
  `clienteStockService.moveStock(cliente.id, {id_libro, precio}, +cantidad, tx)`.
- `devolucion`: `libroService.moveStock(id_libro, +cantidad, tx)` +
  `clienteStockService.moveStock(cliente.id, {id_libro, precio}, -cantidad, tx)`.
- `ventaConsignacion`: sólo `clienteStockService.moveStock(cliente.id,
  {id_libro, precio}, -cantidad, tx)` — no toca `librosTable.stock` (spec:
  "no el stock general del libro").

### Generación de comprobantes dentro de la transacción de base de datos

El spec (casos borde) exige que un fallo en la emisión del comprobante
también deje "el sistema sin cambios" — mismo comportamiento que hoy
(`emitirComprobante`/`facturar` se llaman dentro del `try` antes del
`commit`, en ambos controllers legados). Este plan preserva eso: la llamada a
`generarComprobante` de cada `OperacionConfig` ocurre **dentro** del mismo
`db.transaction(async (tx) => {...})` que inserta la transacción, el detalle
de libros y mueve el stock, no después del commit. Es un trade-off explícito
y heredado, no nuevo de este plan: una transacción de Postgres queda abierta
mientras se hace I/O externo lento (Puppeteer generando un PDF, y para
venta/ventaConsignacion además una llamada HTTP a AFIP), lo cual retiene
locks de fila más tiempo del ideal. Se preserva porque es un requisito
explícito del spec (todo-o-nada incluyendo el comprobante), no una omisión;
se documenta en "Riesgos" para que quede trazable como candidato a revisar
si en producción genera contención.

`generarComprobante` por tipo:
- `venta`/`ventaConsignacion`: si `cliente.tipo != 'negro'`, llama
  `getAfipClient(user)` + `facturar(...)` + `emitirComprobante({venta: ...})`
  (factura); si es `'negro'`, no hace nada (mismo `if` que hoy en
  `venta.controller.ts`).
- `consignacion`: siempre `emitirComprobante({consignacion: ...})` (remito).
- `devolucion`: `null` — no genera comprobante, sólo dejaba `file_path = ""`
  en el legado (se resuelve con `file_path: ""` fijo al insertar la
  transacción de tipo `devolucion`, sin necesidad de una función).

### Controller y router unificados

`src/controllers/venta.controller.ts` **se borra**: sus dos handlers
(`vender`, `ventaConsignado`) dejan de tener razón de ser porque
`OperacionConfig` ya captura lo único que los distinguía de
`transaccion.controller.ts` (parser de body distinto, inserta también en
`ventasTable`, factura en vez de remito). `src/controllers/transaccion.controller.ts`
pasa a exportar tres factories genéricas parametrizadas por `OperacionConfig`:
`crearOperacion(config)`, `listarOperaciones(config)`, `obtenerOperacion(config)`.
`src/routes/transaccion.routes.ts` itera `operacionConfig` (el `Record` de
`operacion.config.ts`) para registrar `GET /:tipo`, `GET /:tipo/:id` y
`POST /:tipo` de las cuatro operaciones desde un único bucle — a diferencia
de hoy, que separaba el `POST` de `venta`/`ventaConsignacion` a mano porque
usaban un controller distinto. Las rutas HTTP observables no cambian (mismos
paths, mismos verbos); sólo se simplifica qué las sirve.

El bug de `connection.release()` triplicado en `VentaController.vender` no
se replica porque deja de existir manejo manual de conexión: `db.transaction`
de Drizzle adquiere/libera la conexión del pool y hace
`COMMIT`/`ROLLBACK` automáticamente según si el callback resuelve o lanza, sin
que el código de la aplicación llame `release()` en ningún punto. No es una
corrección puntual, es una consecuencia de dejar de usar `mysql2`'s
`PoolConnection` a mano.

## Capas afectadas

- schema (`src/schemas/transacciones.schema.ts`, modificado): PK compuesta
  `(id, user)` + `.unique()` en `id` sola (mismo ajuste que `clientesTable`
  en 004, ver "Modelo de datos"). `src/schemas/ventas.schema.ts`,
  `src/schemas/librosTransacciones.schema.ts`: sin cambios (ver "Modelo de
  datos" para el porqué).
- migración Postgres (`db/migrations_pg/`, nueva): generada con `drizzle-kit
  generate` a partir del cambio de PK de `transacciones`. A diferencia de la
  migración de PK de `clientesTable` (004), acá no hay filas reales
  pre-existentes que puedan violar la nueva PK compuesta (todavía no hay
  transacciones migradas en producción), así que el riesgo de esa migración
  es menor.
- migración MySQL: fuera de alcance, mismo motivo que en 004 (toda
  `db/migrations/` se da de baja en una etapa posterior del proyecto). Las
  tablas MySQL `transacciones`, `ventas`, `libros_transacciones` y sus FKs
  quedan huérfanas (sin código que las use) hasta esa baja general.
- validator (`src/validators/transaccion.validator.ts`, ampliado): se agrega
  `transaccionValidator` (`select`/`insert` vía `drizzle-zod` sobre
  `transaccionesTable`) para tipar filas Postgres; se mantienen
  `tipoTransaccion`/`TipoTransaccion` y `createTransaccion` (siguen siendo
  zod puro, sin dependencia de MySQL, reutilizados como `bodyParser` de
  `consignacion`/`devolucion`).
- validator (`src/validators/venta.validator.ts`, ampliado): se agrega
  `ventaValidator` (`select`/`insert` sobre `ventasTable`); se mantienen
  `medioPago`, `tiposComprobantes`, `createVenta`, `createVentaConsignado`
  (zod puro, reutilizados como `bodyParser` de `venta`/`ventaConsignacion`).
- validator (`src/validators/libro.validator.ts`, comentario actualizado):
  el comentario que marca `libroCantidad` como consumido por
  `transaccion.model.ts`/`venta.model.ts` (que se borran) se corrige para
  reflejar que lo siguen usando `transaccion.validator.ts`/`venta.validator.ts`
  (vía `createTransaccion`) — `libroCantidad` es un schema zod genérico
  `{isbn, cantidad}` sin ninguna dependencia de MySQL, así que no se toca su
  definición, sólo el comentario que documentaba quién lo usaba.
- validator (`src/validators/user.validator.ts`, comentario actualizado): el
  bloque de "validators viejos" ya no aplica a `models/user.model.ts` (se
  borra, ver abajo); se corrige el comentario para dejar que sigue vivo sólo
  por `middleware/auth.ts` (`TokenUser`), no por el modelo MySQL.
- tipos de servicio (`src/services/operacion.types.ts`, nuevo):
  `LibroOperacion`, `ComprobanteCtx`, `OperacionConfig` (contratos internos,
  no HTTP — no van en `validators/`).
- service (`src/services/operacion.config.ts`, nuevo): las cuatro
  `OperacionConfig` (composición, ver "Enfoque técnico").
- service (`src/services/transaccion.service.ts`, nuevo): ver "Enfoque
  técnico".
- service (`src/services/venta.service.ts`, nuevo): ver "Enfoque técnico".
- service (`src/services/libro.service.ts`, ampliado): `moveStock`.
- service (`src/services/clienteStock.service.ts`, ampliado): `moveStock`.
- controller (`src/controllers/transaccion.controller.ts`, reescrito
  completo): `crearOperacion`, `listarOperaciones`, `obtenerOperacion`.
- controller (`src/controllers/venta.controller.ts`, **se borra**): ver
  "Enfoque técnico".
- routes (`src/routes/transaccion.routes.ts`, reescrito): itera
  `operacionConfig`.
- otros (`src/comprobantes/comprobante.ts`, ajustado): cambia
  `import { Venta } from '../models/venta.model'` y
  `import { Consignacion, LibroTransaccion, Transaccion } from '../models/transaccion.model'`
  por los tipos nuevos (`VentaConTransaccion` desde `venta.service.ts`/
  `venta.validator.ts`, `TransaccionConCliente`/`LibroOperacion` desde
  `transaccion.service.ts`/`operacion.types.ts`); `import { User } from
  '../models/user.model'` pasa a `import { User } from
  '../validators/user.validator'`. Sin cambios de lógica: sigue leyendo sólo
  campos (`file_path`, `descuento`, `total`, `medio_pago`, `tipo_cbte`,
  `isbn`, `titulo`, `cantidad`, `precio`), nunca métodos de instancia.
- otros (`src/afip/Afip.ts`, ajustado): mismo tipo de cambio de imports
  (`Venta`, `User`, `Client as Cliente` ya apunta a `cliente.validator.ts`
  desde 004). `facturar(pto_venta, venta: VentaConTransaccion, cliente,
  afip)` sigue leyendo sólo `venta.tipo_cbte`/`venta.total`.
- model (`src/models/transaccion.model.ts`, **se borra por completo**, spec).
- model (`src/models/venta.model.ts`, **se borra por completo**, spec).
- model (`src/models/user.model.ts`, **se borra por completo**, huérfano
  descubierto en este feature — ver arriba).
- model (`src/models/libro.model.ts`, `src/models/persona.model.ts`,
  **sin cambios**): siguen vivos, usados por `liquidacion.controller.ts`
  (fuera de alcance).
- tests (`test/venta.test.ts`, `test/consignacion.test.ts`,
  `test/venta_consignacion.test.ts`, reescritos contra Postgres/endpoints
  nuevos; `test/afip.test.ts`, ajustado: `Transaccion`/`Venta`/`User` (MySQL)
  → tipos/servicios Postgres).

## Modelo de datos

**`transaccionesTable` (Postgres)**: pasa de PK simple (`id`) a PK compuesta
`(id, user)` + `.unique()` en `id` sola, mismo ajuste y mismo motivo que
`clientesTable` en 004 (`ventasTable.id_transaccion` y
`librosTransaccionesTable.id_transaccion` referencian `transaccionesTable.id`
sola, y Postgres exige que una columna referenciada por FK sea única). A
diferencia de `clientesTable`, el código de este feature no usa
`ServiceBuilder.findOne`/`update`/`delete` sobre esta tabla (ver "Enfoque
técnico"), así que la PK compuesta no habilita un `findOne({id, user})`
automático acá — se adopta igual por consistencia con el resto del proyecto
(mismo patrón "tabla de un usuario") y como defensa en profundidad a nivel de
base de datos ante cualquier query futura que use la PK directamente, aunque
hoy la verificación de dueño la hace el `WHERE user = ?` explícito en los
JOIN de `transaccion.service.ts`.

**`ventasTable` (Postgres)**: sin cambios. No necesita columna `user` propia
ni ajuste de PK: su único punto de entrada es siempre a través de una
`transaccionesTable.id` ya resuelta y validada por dueño (JOIN, nunca se
busca una venta por su propio id suelto sin pasar por esa validación). Mismo
razonamiento que se usó para no tocar `libroClienteTable`/
`precioLibroClienteTable` en 004.

**`librosTransaccionesTable` (Postgres)**: sin cambios; su PK compuesta
`(id_libro, id_transaccion)` ya es correcta para lo que este feature
necesita (nunca se accede a una fila suelta sin pasar por la transacción
dueña).

**`transacciones`/`ventas`/`libros_transacciones` (MySQL)**: dejan de ser
referenciadas por cualquier código de este feature (`transaccion.model.ts`/
`venta.model.ts` se borran), pero no se dropean (misma razón que `clientes`
en 004: toda `db/migrations/` se borra en una etapa posterior). Quedan
huérfanas hasta esa baja general.

## Compatibilidad con módulos no migrados

`liquidacion` es el único módulo que sigue en MySQL y, según el grep inicial
de este plan, **no depende en absoluto** de `transaccion`/`venta` (ni del
modelo viejo ni del nuevo): lee directamente `Libro`, `Persona`,
`LibroPersona`, `Liquidacion` (MySQL) sin pasar por ninguna de las dos tablas
que este feature migra. No hay ningún riesgo de divergencia de datos entre
MySQL y Postgres para `transacciones`/`ventas`/`libros_transacciones`: después
de este feature, ningún código de la aplicación lee ni escribe esas tres
tablas en MySQL (quedan huérfanas, ver "Modelo de datos"), así que Postgres
pasa a ser la única fuente de verdad sin ambigüedad — mismo resultado que
logró 004 para `cliente`, ahora también para `transaccion`/`venta`.

Con este feature, el único código MySQL "core" que queda vivo es
exactamente el que sostiene a `liquidacion` (`libro.model.ts`,
`persona.model.ts`, `libro_persona.model.ts`, `liquidacion.model.ts`,
`user.model.ts` **ya no**, se borra en este feature) — ver spec, "no es
dependencia bloqueante", y queda confirmado en la práctica.

## Decisiones y trade-offs

**Reemplazo de la jerarquía de clases por un `Record<TipoTransaccion,
OperacionConfig>` (composición) en vez de mantener clases con métodos
sobreescritos.** Ver "Enfoque técnico" para el detalle; es la decisión
explícitamente pedida por CLAUDE.md ("Inyección de dependencias > herencia")
y por el spec ("Herencia vs. composición"). Se gana testabilidad por tipo de
operación sin necesitar una jerarquía completa instanciada, y que agregar una
operación nueva no dependa de acordarse de sobreescribir todos los métodos
correctos (el compilador exige el objeto completo). Se pierde el
polimorfismo estructural de una clase abstracta; se compensa con el tipado
estricto de `OperacionConfig`.

**No usar `ServiceBuilder` para `transacciones`/`ventas`/`libros_transacciones`,
a diferencia del patrón por defecto usado en `cliente`/`libro`/`persona`.**
Se gana: todas las lecturas necesitan JOIN con `clientesTable` de entrada (no
hay un caso de uso real de "traer una transacción sola sin datos del
cliente"), y todas las escrituras viven dentro de una transacción de varios
pasos armada a mano — el CRUD genérico de `ServiceBuilder` no cubre ninguno
de los dos casos sin terminar escribiendo la misma query a mano de todos
modos. Se pierde la consistencia de "todas las tablas de un usuario pasan
por `ServiceBuilder`"; se documenta acá porque es una desviación real del
patrón por defecto, mismo tipo de excepción ya aceptada para
`libroPersonaService`/`clienteStockService`.

**`moveStock` como upsert único (`ON CONFLICT DO UPDATE`) en vez de dos
funciones separadas (`addStock`/`reduceStock`).** Se gana una sola función
que cubre "sumar o restar un delta", sin duplicar el `WHERE (id_libro,
id_cliente)`; una consignación puede necesitar crear la fila de
`libro_cliente` la primera vez (no hay upsert que evitar). Se pierde
expresividad en el nombre de la función (un `moveStock(..., -N, ...)` es
menos autoexplicativo que `reduceStock(..., N, ...)`), mitigado con nombres
de parámetro claros y comentario en el propio service.

**`resolverLibros` de `ventaConsignacion` llama dos veces a
`clienteStockService.getStock` (una con `fecha`, otra sin) en vez de agregar
una tercera función "stock actual + precio histórico" a `clienteStockService`.**
Se gana no tocar la firma de un service ya usado por `GET /cliente/:id/stock`
(004) sólo para este caso puntual de `venta/ventaConsignacion`. Se pierde una
query extra por request de venta en consignación (costo despreciable,
tablas chicas). Alternativa descartada: exponer `getStockActual`/
`getStockAFecha` (privadas hoy) para componerlas en una sola llamada desde
acá — se prefiere no ampliar la superficie pública de `clienteStockService`
para un único consumidor.

**Comprobante/facturación dentro de la misma transacción de Postgres, no
después del commit.** Ver "Enfoque técnico" — requisito explícito del spec
(casos borde: "cualquier fallo... deja el sistema sin cambios"), heredado del
comportamiento legado, no una decisión nueva de este plan. Se documenta el
costo (locks retenidos durante I/O externo lento) en "Riesgos".

**Se borra `src/controllers/venta.controller.ts` y se fusiona en
`transaccion.controller.ts`, en vez de mantener dos archivos de controller
como hoy.** Se gana eliminar la asimetría artificial que tenía el código
legado (dos controllers para lo que ya es "una operación con configuración
distinta"), acorde a "una función, una responsabilidad" de CLAUDE.md
aplicado a nivel de archivo: ya no hace falta un archivo aparte sólo para
`vender`/`ventaConsignado`. Se pierde: el histórico de git de
`venta.controller.ts` no continúa en el archivo nuevo (aparece como
borrado + contenido nuevo en `transaccion.controller.ts`); no hay pérdida de
funcionalidad, las rutas HTTP no cambian.

**Se borra `src/models/user.model.ts` aunque el spec no lo pide
explícitamente.** Ver "Hallazgo previo" — queda huérfano como consecuencia
directa de reemplazar `User.getById` (MySQL) por `userService.findOne`
(Postgres, ya existente de 001) en los dos controllers que se tocan acá. Se
gana no dejar una clase MySQL sin ningún consumidor real dando vueltas en el
repo (mismo criterio "no código muerto" ya aplicado a `cliente.model.ts` en
004). Se pierde: es un cambio de alcance no pedido literalmente por el spec
de este feature — se documenta acá para que quede trazable como una
decisión tomada por el planner, no descubierta a mitad de implementación.

## Riesgos

- **Transacciones de Postgres abiertas durante I/O externo (Puppeteer +
  AFIP).** Ver "Enfoque técnico"/"Decisiones y trade-offs": es un
  comportamiento heredado y requerido por el spec, no nuevo, pero conviene
  medir en producción si genera contención de locks en `transacciones`/
  `libros`/`libro_cliente` bajo carga concurrente — no es tarea de este
  feature resolverlo, sólo de no empeorarlo.
- **Ausencia de locking explícito en `moveStock`.** El `UPDATE ... SET stock
  = stock + delta` es atómico a nivel de fila, pero dos operaciones
  concurrentes sobre el mismo libro/cliente que pasaron la validación de
  stock *antes* de que la otra hiciera su `UPDATE` pueden dejar stock
  negativo (mismo comportamiento — o falta de comportamiento — que el código
  MySQL legado, que tampoco usaba `SELECT ... FOR UPDATE`). No es una
  regresión de este plan, pero tampoco se corrige acá; si aparece en
  producción, es candidato a un feature aparte con locking explícito.
- **`resolverLibros`/`moverStock` son la superficie con más lógica nueva y
  sin precedente MySQL directo que copiar** (a diferencia de `venta`/
  `consignacion`, que sí tienen equivalente MySQL claro en
  `Libro.updateStock`): el merge de `getStockActual`/`getStockAFecha` para
  `ventaConsignacion`, y el caso borde de libro nunca antes recibido por el
  cliente (`libro_cliente` sin fila) en `ventaConsignacion`/`devolucion`, no
  tienen un código MySQL funcionando de referencia para comparar
  comportamiento 1 a 1 (el legado los dejaba en `stockDeClienteNoMigrado()`).
  Vale la pena revisión manual/QA explícita de estos dos casos, más que del
  resto (que sí replica lógica MySQL existente).
- **Ampliación de alcance sobre `user.model.ts`** (ver "Decisiones y
  trade-offs"): no es parte literal del spec; si en paralelo otro feature
  está tocando ese archivo, puede haber conflicto de coordinación.

## Fuera de alcance / deuda aceptada

- Migrar `liquidacion`: sigue en MySQL (spec, "No incluye"); confirmado por
  grep que no depende de `transaccion`/`venta`.
- Migrar la generación de comprobantes en sí (`comprobante.ts`, `Afip.ts`):
  sólo se ajustan imports/tipos, no su lógica (spec, "No incluye").
- Anulación/edición de una venta o transacción ya registrada: no existe en
  el legado, no se agrega acá (spec, "No incluye").
- Locking explícito (`SELECT ... FOR UPDATE` o equivalente) sobre
  `libros.stock`/`libro_cliente.stock` para eliminar la ventana de carrera
  entre validación y movimiento de stock: no lo tenía el legado, no lo
  agrega este plan (ver "Riesgos").
- No se migran datos históricos de `transacciones`/`ventas`/
  `libros_transacciones` de MySQL a Postgres: los endpoints de este feature
  arrancan reflejando sólo lo que se cargue de acá en adelante (mismo
  criterio que 004 para `cliente`/`libro_cliente`).
- No se escribe la migración MySQL (`_up`/`_down`) que dropea las tablas ni
  sus FKs: diferido a la baja completa de `db/migrations/` en una etapa
  posterior del proyecto (mismo criterio que 004).
