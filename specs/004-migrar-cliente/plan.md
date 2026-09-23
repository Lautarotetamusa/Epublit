# Plan: Migrar el módulo `cliente` a la nueva arquitectura

## Spec de referencia
specs/004-migrar-cliente/spec.md

## Decisión del usuario que reemplaza el enfoque original (sin soporte dual)
Este plan asumía originalmente que `src/models/cliente.model.ts` (MySQL) se
mantenía vivo para que `venta`/`transaccion` (no migrados) lo siguieran
usando, igual que se hizo con `libro_persona`/`liquidacion`. El usuario
decidió explícitamente que para `cliente` **no** hace falta ese soporte
dual: se borra `src/models/cliente.model.ts` entero y la tabla MySQL
`clientes` (con sus FKs), aunque eso rompa `venta`/`transaccion` en tiempo
de compilación y de ejecución. Esta sección documenta qué cambia respecto
del enfoque original; el resto del plan (CRUD Postgres de `cliente`, stock)
no cambia.

**Ajuste posterior del usuario, sobre el "se borra ... la tabla MySQL
`clientes`" de arriba**: el borrado de `src/models/cliente.model.ts` (código)
se mantiene tal cual. El borrado físico de la tabla MySQL `clientes` (y sus
FKs/trigger) se saca del alcance de este feature: toda la carpeta
`db/migrations/` (MySQL) se va a borrar por completo en una etapa posterior
del proyecto (la base MySQL entera se da de baja, no sólo `clientes`), así
que no vale la pena escribir ahora una migración `_up`/`_down` prolija sólo
para esta tabla. Ver "Capas afectadas" y "Modelo de datos" para el detalle
de qué implica esto en la práctica (la tabla sigue existiendo físicamente,
sólo deja de tener código que la use).

## Enfoque técnico
`cliente` tiene dos partes con necesidades distintas:

1. **CRUD de `clientesTable`**: es una tabla "de un usuario" como `libro`/
   `persona`, así que sigue exactamente ese patrón — `ServiceBuilder` +
   PK compuesta `(id, user)` para que bradb garantice el aislamiento por
   dueño en `findOne`/`update`/`delete` sin chequeos manuales. Hoy
   `clientesTable` (Fase 0) no tiene ese patrón: PK simple en `id`, sin
   `deletedAt`. Se ajusta el schema (ver "Modelo de datos") antes de escribir
   el service, igual que se hizo al migrar `libro`/`persona`.

2. **Stock (`libroClienteTable`/`precioLibroClienteTable`)**: igual que
   `libros_personas`, estas tablas no tienen columna `user` propia; su dueño
   se hereda de `id_cliente` → `clientesTable`. Se aplica el mismo patrón que
   ya usa `src/services/libroPersona.service.ts`: nada de `ServiceBuilder`
   puro para estas dos tablas, un service explícito
   (`src/services/clienteStock.service.ts`) que primero resuelve el cliente
   dueño vía `clienteService.findOne({id, user})` (que ya tira `NotFound` si
   no existe/no es propio) y sólo después arma queries scopeadas por
   `id_cliente = cliente.id`. No hace falta agregar columna `user` a
   `libroClienteTable`/`precioLibroClienteTable` ni tocar su PK: a diferencia
   de `libros_personas` (donde el dueño depende de **dos** tablas, libro y
   persona, cada una potencialmente de otro usuario si no se valida), acá el
   único punto de entrada a estas dos tablas en este feature es siempre por
   `id_cliente` de un cliente ya validado como propio — no hay ningún
   endpoint que reciba `id_libro` como input directo del usuario, así que no
   existe la ventana de ambigüedad que sí justificaba tocar la PK en
   `libro_persona`.

El resto de las reglas de negocio (forzar `tipo: "inscripto"` en alta, no
poder editar/eliminar el "consumidor final", ahora también no poder eliminar
"MOSTRADOR", validar duplicado de cuit, re-consultar AFIP sólo si cambia el
cuit) se replican en `src/services/cliente.service.ts` y
`src/controllers/cliente.controller.ts`, siguiendo la división de
responsabilidades ya usada en `persona`/`libro`: el controller resuelve el pk
de la URL y hace el chequeo de duplicado (necesita comparar contra el estado
actual, igual que `persona.controller.ts`); el service encapsula la lógica de
dominio que no es un simple `WHERE` (forzar tipo, re-consultar AFIP, bloquear
edición/borrado de clientes especiales), igual que `libro.service.ts`
encapsula el registro de historial de precio dentro de `updateLibro`.

`GET /cliente/consumidor_final` se elimina (spec, "No incluye"): no hay
código nuevo que lo reemplace, `GET /cliente?tipo=particular` ya lo cubre
con el filtro `tipo` del `findAll`.

**`GET /cliente/:id/ventas` se mantiene registrada, pero su handler responde
501 (`NotImplemented`) en vez de intentar resolver contra el modelo MySQL
que se borra.** El spec original la dejaba "fuera de alcance" (no migrada)
asumiendo que `src/models/cliente.model.ts` seguía vivo para soportarla
(`Cliente.getVentas()`, instancia MySQL). Al borrar ese modelo por completo
(ver "Decisión del usuario" arriba) no queda ninguna implementación real
posible para esa ruta, pero el usuario confirmó que la ruta debe seguir
existiendo igual: `src/controllers/cliente.controller.ts` conserva
`getVentas` como handler, reemplazando su cuerpo por
`throw new NotImplemented("GET /cliente/:id/ventas no está migrado; se resuelve junto con venta/transaccion")`
(misma clase `NotImplemented` que se agrega a `src/models/errors.ts`, ver
"Ripple..."), en vez de sacar la ruta. La funcionalidad real de "ventas de
un cliente" se resuelve recién cuando `venta`/`transaccion` migren — hasta
entonces el endpoint existe y responde de forma explícita y consistente
(501), no desaparece ni intenta simular un resultado con datos parciales o
desactualizados.

## Ripple de la baja de `src/models/cliente.model.ts` en módulos no migrados
`venta` y `transaccion` (no migrados) dependen hoy en profundidad del
modelo MySQL de `Cliente`: como tipo (`Cliente` en firmas de
`venta.model.ts`, `transaccion.model.ts`, `comprobante.ts`, `Afip.ts`) y
como valor (`Cliente.getById`, `cliente.getLibros`, `cliente.addStock`,
`cliente.reduceStock`, `generateClientPath`). Borrar el archivo entero sin
tocar nada más rompe la compilación de todos esos módulos. El objetivo de
este ajuste es **sólo que el repo compile**, no arreglar de verdad
`venta`/`transaccion` con cliente — esa migración es la próxima en el orden
acordado, no ésta. Archivos que hay que tocar, y hasta dónde:

- `src/services/cliente.service.ts` (nuevo, de este feature): exporta,
  además del CRUD, `generateClientPath` (se mueve tal cual desde
  `cliente.model.ts`, es una función pura sin dependencia de MySQL) y
  reexporta el tipo `Client = z.infer<typeof clienteValidator.select>` (o
  se importa directo desde `cliente.validator.ts`) para que los módulos de
  abajo tengan de dónde importar sin volver a `models/cliente.model.ts`.
- `src/controllers/venta.controller.ts`, `src/controllers/transaccion.controller.ts`:
  cambian `import { Cliente, generateClientPath } from "../models/cliente.model"`
  por `import { generateClientPath } from "../services/cliente.service"` y
  `import { Client } from "../validators/cliente.validator"` (sólo tipo).
  `Cliente.getById(id, user.id)` (MySQL) se reemplaza por
  `clienteService.findOne({id, user: user.id})` (Postgres, del nuevo
  service de este feature) — a diferencia de todo lo demás en esta sección,
  este cambio puntual **sí queda funcional**, no es un stub: como
  `clientesTable` de Postgres pasa a ser la única fuente de verdad para
  `cliente` a nivel de código (ver "Compatibilidad con módulos no
  migrados"), resolver el cliente de una venta/transacción contra Postgres
  es correcto y no requiere arreglar el resto del flujo para funcionar.
- `src/models/venta.model.ts`, `src/models/transaccion.model.ts`: cambian el
  tipo `Cliente` de sus firmas (`stockMovement`, `comprobante`, `setLibros`,
  etc.) por el `Client` importado de `cliente.validator.ts`. Los call sites
  que llaman métodos de instancia que ya no existen en ese tipo
  (`cliente.getLibros(...)` en `setLibros`, `cliente.addStock(...)`/
  `cliente.reduceStock(...)` en `stockMovement`) se reemplazan por una
  función local `stockDeClienteNoMigrado(): never` que hace
  `throw new NotImplemented("Movimiento de stock de cliente todavía no migrado a Postgres (ver venta/transaccion)")`
  — `NotImplemented` no existe hoy en `src/models/errors.ts`; se agrega ahí
  siguiendo el mismo patrón que `NotFound`/`ValidationError`/etc.
  (`extends ApiError`, status `501`), no un `@ts-ignore` ni un `any`. Esto es un ajuste **mínimo a propósito**: no se intenta
  portar `addStock`/`reduceStock`/`getLibros` a Postgres acá (ver spec, "No
  incluye"; sigue siendo tarea de la migración de `venta`/`transaccion`).
- `src/comprobantes/comprobante.ts`, `src/afip/Afip.ts`: cambian
  `import { Cliente } from '../models/cliente.model'` por
  `import { Client as Cliente } from '../validators/cliente.validator'`
  (alias para no renombrar el parámetro `cliente: Cliente` en toda la
  firma de `facturar`); no usan métodos de instancia de `Cliente`, sólo
  leen campos (`razon_social`, `cuit`, etc.), así que no hace falta ningún
  stub ahí, es un cambio de import puro.
- Consecuencia en runtime, explícita: después de este deploy,
  `POST`/`PUT /venta` y `POST`/`PUT /transaccion` para los tipos que tocan
  stock de cliente (consignación y afines, cualquier flujo que pase por
  `stockMovement`/`setLibros` con libros) van a fallar con
  `NotImplemented` en vez de devolver una respuesta incorrecta o silenciosa.
  Los flujos de venta/transacción que no dependen de esos dos métodos (si
  los hay) siguen funcionando porque el resto de `venta`/`transaccion`
  sigue sobre MySQL sin cambios. No se decide en este plan cuáles son
  exactamente esos flujos no afectados — queda para `sdd-task-breakdown`
  verificarlo al tocar estos archivos.

## Capas afectadas
- schema (`src/schemas/clientes.schema.ts`, modificado): PK compuesta
  `(id, user)`, `.unique()` en `id` sola, `deletedAt: timestamp("deleted_at")`
  nullable. `libroCliente.schema.ts`/`precioLibroCliente.schema.ts`: sin
  cambios (ver "Modelo de datos").
- migración Postgres (`db/migrations_pg/`, nueva): generada con `drizzle-kit
  generate` a partir del cambio de schema de `clientes`; revisar a mano el
  SQL generado porque altera la PK de una tabla que ya tiene filas reales
  (los clientes autocreados por `user.service.ts`) — confirmar que el
  `ALTER TABLE ... DROP CONSTRAINT` + `ADD PRIMARY KEY` no falla por datos
  existentes (no debería: `user` ya es `NOT NULL` y no hay motivo para
  duplicados de `(id, user)` ya que `id` es identity).
- migración MySQL: **fuera de alcance de este feature** (ajuste posterior
  del usuario, ver "Decisión del usuario" arriba). Toda la carpeta
  `db/migrations/` (MySQL) se va a borrar por completo en una etapa
  posterior del proyecto, así que no se escribe ahora una migración
  `_up`/`_down` para dropear las FKs `libro_cliente_ibfk_2`
  (`libro_cliente.id_cliente` → `clientes.id`),
  `precio_libro_cliente_ibfk_2` (`precio_libro_cliente.id_cliente` →
  `clientes.id`) y `transacciones_ibfk_1` (`transacciones.id_cliente` →
  `clientes.id`), el trigger `crear_clientes_por_usuario` ni la tabla
  `clientes` — ese DROP queda diferido a cuando se borre toda la carpeta de
  migraciones MySQL, no es tarea de este feature. La tabla MySQL `clientes`
  y esas tres FKs **siguen existiendo físicamente** en la base después de
  este feature; sólo dejan de tener código que las use (se borra
  `src/models/cliente.model.ts`, ver "Capas afectadas" más abajo), quedando
  huérfanas hasta esa baja general.
- validator (`src/validators/cliente.validator.ts`, ampliado y podado): se
  agrega un grupo `clienteValidator` (`select`, `insert`, `update`,
  `filter`, `pk`) igual que `personaValidator`/`libroValidator`, y se borra
  el bloque viejo específico de MySQL que después de este cambio ya no usa
  nadie: `ClienteSchema`, `SaveClienteInscripto`, `UpdateCliente`,
  `updateCliente`, `createCliente`, `LibroClienteSchema`, `StockCliente`
  (confirmado por grep: sólo los usan `cliente.model.ts`/
  `cliente.controller.ts` viejos, ninguno de los otros módulos). Se
  **mantienen** `tipoCliente`/`TipoCliente`: a diferencia del resto, esos sí
  siguen consumidos por `venta.model.ts`, `transaccion.model.ts`,
  `venta.controller.ts`, `transaccion.controller.ts` y varios tests — no son
  parte del "bloque MySQL" a borrar, son un enum de dominio reutilizable que
  no depende de la clase `Cliente` ni de MySQL.
  - `insert = createInsertSchema(clientesTable).omit({id:true, user:true,
    deletedAt:true, cond_fiscal:true, razon_social:true, domicilio:true,
    tipo:true})`: sólo `{nombre, email?, cuit}`. Omitir `tipo` (en vez de
    aceptarlo e ignorarlo a mano) es la forma de que "enviar `tipo` en el
    body no tiene efecto" (spec, casos borde) sea una garantía del schema:
    zod descarta claves no declaradas por default, no hace falta un
    `delete body.tipo` explícito en ningún lado.
  - `update = insert.partial()`: mismo shape, todo opcional.
  - `filter`: `{user: z.number(), tipo: z.enum(Object.keys(tipoCliente) as
    [TipoCliente])}.partial()`, para `findAll` con filtro opcional por tipo.
  - `pk = createPkSchema(clientesTable).pick({id: true})`.
  - `export type Client = z.infer<typeof select>`: el tipo que reemplaza a
    la clase `Cliente` en las firmas de `venta`/`transaccion`/`comprobante`/
    `Afip` (ver "Ripple...").
- filter (`src/filters/cliente.filter.ts`, nuevo): `clienteFilterMap` con
  `user` y `tipo` (`eq` sobre `clientesTable.user`/`clientesTable.tipo`),
  mismo patrón que `libroFilterMap`.
- service (`src/services/cliente.service.ts`, nuevo): CRUD de
  `clientesTable` vía `ServiceBuilder` + lógica de dominio (ver "Enfoque
  técnico" y "Decisiones y trade-offs") + `generateClientPath` reubicada
  (ver "Ripple...").
- service (`src/services/clienteStock.service.ts`, nuevo): `getStock`,
  `syncPrecios` sobre `libroClienteTable`/`precioLibroClienteTable`.
- controller (`src/controllers/cliente.controller.ts`, reescrito
  completo): `create`, `update`, `delet`, `getAll`, `getOne`, `getStock`,
  `updatePrecios` sobre los services nuevos. `getVentas` se mantiene, pero
  como un handler que sólo tira `NotImplemented` (501) — ver "Enfoque
  técnico".
- controller (`src/controllers/venta.controller.ts`,
  `src/controllers/transaccion.controller.ts`, ajuste mínimo): ver
  "Ripple...".
- model (`src/models/venta.model.ts`, `src/models/transaccion.model.ts`,
  ajuste mínimo): ver "Ripple...".
- otros (`src/comprobantes/comprobante.ts`, `src/afip/Afip.ts`, ajuste de
  import únicamente): ver "Ripple...".
- model (`src/models/cliente.model.ts`, **se borra por completo**).
- routes (`src/routes/cliente.routes.ts`, editado): se quita
  `router.get('/consumidor_final', ...)`. `router.get('/:id/ventas', ...)`
  se mantiene, apuntando al `getVentas` que ahora responde 501 (ver
  "Enfoque técnico"). El resto de las rutas no cambia de forma/orden.
- tests (`test/cliente.test.ts`, reescrito para Postgres; `test/afip.test.ts`,
  ajustado: `Cliente.getById` → `clienteService.findOne`;
  `test/consignacion.test.ts`/`test/venta_consignacion.test.ts`, revisar caso
  por caso qué sigue siendo válido contra flujos de `venta`/`transaccion`
  que ahora tiran `NotImplemented` en el tramo de stock de cliente — ver
  "Riesgos").

## Modelo de datos

**`clientesTable` (Postgres)** pasa de PK simple (`id`) a PK compuesta
`(id, user)` + `.unique()` en `id` sola (igual que
`personasTable`/`librosTable`): `libroClienteTable.id_cliente` y
`precioLibroClienteTable.id_cliente` referencian `clientesTable.id` sola, y
Postgres exige que una columna referenciada por FK sea única — de ahí el
`.unique()` explícito además de la PK compuesta, mismo comentario que ya
existe en `personas.schema.ts`. Se agrega `deletedAt: timestamp("deleted_at")`
nullable para que bradb detecte soft-delete (mismo mecanismo que
`libros`/`personas`); `DELETE /cliente/:id` pasa a ser un soft delete, no un
`DELETE` físico como hacía el modelo MySQL.

**`libroClienteTable`/`precioLibroClienteTable` (Postgres)**: sin cambios de
schema. Mantienen su PK actual (`(id_libro, id_cliente)` y `id`
autoincremental respectivamente). No se agrega columna `user`: ver "Enfoque
técnico" para por qué el caso es distinto al de `libros_personas`.

**`clientes` (MySQL)**: deja de ser referenciada por cualquier código de
este feature (`src/models/cliente.model.ts` se borra, ver "Decisión del
usuario"), pero **no se dropea como parte de este feature** — ver "Capas
afectadas" para el motivo (toda la carpeta de migraciones MySQL se borra en
una etapa posterior del proyecto, no vale la pena una migración prolija
ahora sólo para esta tabla). La tabla, sus tres FKs (`libro_cliente`,
`precio_libro_cliente`, `transacciones`) y el trigger
`crear_clientes_por_usuario` quedan huérfanos en la base hasta esa baja
general. A partir de este feature, **Postgres es la única fuente de verdad
para `cliente` a nivel de código**, sin excepción — no queda ningún código
que pueda leer/escribir la tabla MySQL de clientes ni divergir contra ella,
aunque la tabla siga físicamente presente en la base.

## Compatibilidad con módulos no migrados

**El riesgo de "dos espacios de id de cliente" (Postgres vs. MySQL) que
tenía la versión anterior de este plan queda resuelto de raíz a nivel de
código, no sólo documentado.** Aunque la tabla MySQL `clientes` sigue
existiendo físicamente (ver "Modelo de datos"), no hay ningún código que la
lea o escriba después de este feature, así que no hay ninguna ambigüedad
posible sobre qué tabla es la fuente de verdad: es Postgres, siempre. El
ajuste puntual y funcional de `venta.controller.ts`/`transaccion.controller.ts`
para resolver el cliente contra `clienteService.findOne` (ver "Ripple...")
hace que, para el propósito limitado de "encontrar los datos de un cliente
propio dado su id", `venta`/`transaccion` ya queden apuntando a Postgres
igual que el resto de los endpoints migrados — no hace falta esperar a que
esos módulos migren del todo para que esa parte puntual funcione bien.

**El riesgo de stock de cliente (`addStock`/`reduceStock`/`getLibros` sin
implementación) cambia de naturaleza: de "diverge en silencio" a "falla en
voz alta".** La versión anterior de este plan describía un escenario donde
`venta`/`transaccion` seguían escribiendo/leyendo un `libro_cliente` MySQL
por su cuenta, desincronizado del `libroClienteTable` de Postgres de este
feature. Esos métodos ya no existen en ningún código (se borra
`cliente.model.ts`); `libro_cliente`/`precio_libro_cliente` de MySQL quedan
huérfanas sin ningún código que las use (aunque, a diferencia de una
versión anterior de este plan, siguen existiendo físicamente hasta la baja
general de `db/migrations/`, ver "Modelo de datos"). El resultado concreto
es que **no hay ningún camino, ni MySQL ni Postgres, que mueva stock de
cliente al vender/consignar** hasta que `venta`/`transaccion` migren: los
call sites de `stockMovement`/`setLibros` que antes tocaban MySQL ahora
tiran `NotImplemented` (ver "Ripple..."). Es una regresión funcional real
y deliberada (no una limitación oculta), consistente con la directiva ya
aceptada de priorizar migrar por sobre no romper nada en el camino.

`GET /cliente/:id/stock`/`PUT /cliente/:id/stock` (este feature) siguen
operando sólo sobre `libroClienteTable`/`precioLibroClienteTable` de
Postgres, que arrancan sin datos migrados desde MySQL (ver "Fuera de
alcance"): un cliente no va a tener stock ahí hasta que algo lo cargue, y
hoy nada lo carga (ni el `addStock` viejo, que se borra, ni un reemplazo
nuevo, que no es parte de este feature).

## Decisiones y trade-offs

**Borrar `src/models/cliente.model.ts` (código) sin dropear todavía la
tabla MySQL `clientes`, en vez de mantener ambos vivos para
`venta`/`transaccion` (decisión explícita del usuario, reemplaza el enfoque
de "soporte dual" usado en `libro_persona`; el propio borrado físico de la
tabla se ajustó después, ver "Decisión del usuario").** Se gana: una sola
fuente de verdad para `cliente` a nivel de código desde el día uno (nada de
ids duplicados ni datos desincronizados entre MySQL y Postgres en lo que
efectivamente lee/escribe la aplicación, ver "Compatibilidad con módulos no
migrados"), menos código muerto/paralelo que mantener, y no gastar esfuerzo
en una migración MySQL prolija para una tabla cuya carpeta entera de
migraciones se va a borrar en otra etapa. Se pierde: `venta`/`transaccion`
pierden funcionalidad real (mover stock de cliente) hasta que migren, en
vez de seguir funcionando sobre MySQL como hoy; y la tabla MySQL `clientes`
queda huérfana en la base (sin código que la use) hasta la baja general en
vez de desaparecer ya. Es la alternativa elegida explícitamente por el
usuario, contra el criterio por default de este agente (que hubiera
propuesto el patrón dual ya usado en `libro_persona`/`liquidacion`); se
documenta acá el motivo del cambio de criterio para que quede trazable.

**Los call sites sin reemplazo tiran `NotImplemented` en vez de quedar
comentados o con un `// @ts-expect-error`.** Se gana: el problema es visible
en runtime (un 500 con mensaje claro) en vez de silencioso o de romper la
compilación de todo el módulo por un comentario mal puesto; sigue el mismo
estilo de manejo de errores de dominio que ya usa el resto del proyecto
(`NotFound`, `ValidationError`, etc., en `src/models/errors.ts`). Se
pierde: nada relevante — no había ninguna alternativa que preservara el
comportamiento funcional sin re-implementar `addStock`/`reduceStock` contra
Postgres, que es explícitamente trabajo de la migración de
`venta`/`transaccion`, no de ésta.

**`GET /cliente/:id/ventas` se mantiene registrada y responde 501
(`NotImplemented`) en vez de eliminarse.** Se gana: la ruta sigue existiendo
en la API tal como la conocen sus consumidores (no es un breaking change de
"la ruta desapareció"), con una respuesta explícita que deja claro que la
funcionalidad todavía no está migrada, en vez de un error genérico 500 o un
404 engañoso. Se pierde: queda una ruta que nunca devuelve datos reales
hasta que `venta`/`transaccion` migren — un cliente de la API que no lea el
código de error puede confundirse con un 404 real. Confirmado explícitamente
por el usuario como la resolución preferida por sobre eliminar la ruta.

**Soft delete real (`deletedAt`) en vez del `DELETE` físico que hace hoy el
modelo MySQL.** Se gana: consistencia con `libro`/`persona`, que ya usan
`deletedAt`, y con la exigencia de CLAUDE.md de no duplicar patrones
distintos para el mismo problema. Se pierde: nada funcional — el
criterio de aceptación del spec ("deja de aparecer en `GET /cliente` y
`GET /cliente/:id` responde no encontrado") se cumple igual con soft
delete, que además es más seguro (recuperable). Es la alternativa correcta
porque ya es el patrón establecido del proyecto para esta migración.

**`DELETE /cliente/:id` bloquea tipo "particular" Y tipo "negro", chequeando
sólo `tipo`, no "es específicamente EL MOSTRADOR autocreado".** El spec
mismo (casos borde) aclara que ambas cosas son equivalentes hoy porque
`POST /cliente` siempre fuerza `tipo: "inscripto"`, así que no hay forma de
que exista un cliente tipo "negro" que no sea el MOSTRADOR autocreado.
Chequear por tipo es más simple que buscar por nombre/flag especial y
cubre exactamente los mismos casos hoy. Trade-off documentado explícitamente
porque el spec ya advierte que si en el futuro se permite crear otros
clientes tipo "negro" hay que revisar esta regla — no se agrega ninguna
protección extra ahora porque el spec no la pide (YAGNI).

**`clienteService.update` hace su propio `findOne` interno para decidir si
hay que re-consultar AFIP y si el cliente es "particular", aunque el
controller ya hizo un `findOne` propio para el chequeo de cuit duplicado.**
Se gana: la lógica de "cuándo hace falta AFIP" y "no se puede tocar el
particular" vive en un solo lugar (el service), igual que
`libro.service.ts`'s `updateLibro` decide sola cuándo insertar historial de
precio aunque el controller de libro también resuelve el libro antes. Se
pierde: una query de más por request (costo despreciable). Es el mismo
trade-off ya aceptado en `libro`, no uno nuevo de este feature.

**`PUT /cliente/:id/stock` ya no lanza error si ningún precio está
desactualizado (corrige el bug de `NothingChanged` del modelo MySQL, que
tiraba error y dejaba el endpoint sin poder devolver 200 "sin cambios").**
El spec lo pide explícitamente como criterio de aceptación ("responde
igualmente 200 con el stock (sin cambios)"); `syncPrecios` simplemente no
lanza si el `UPDATE`/`INSERT` de sincronización no afecta filas, y siempre
devuelve el stock actual al final.

**Historial de precio: se sigue grabando el precio *nuevo* del libro en
`precio_libro_cliente` en el momento en que se sincroniza (no el precio
anterior), igual que hace hoy el modelo MySQL.** El texto del spec dice
"deja registrado en el historial de precios el valor anterior", pero el
criterio de aceptación real es preservar el comportamiento observable
actual (`GET /cliente/:id/stock?fecha=...` debe poder reconstruir qué precio
regía en cualquier fecha pasada), y la única forma en que el código MySQL
logra eso es grabando cada precio nuevo con su propio timestamp de vigencia
("desde esta fecha, el precio es X") — el precio "anterior" ya había quedado
grabado en su propio momento de vigencia. Cambiar esa semántica ahora
(grabar el precio viejo con timestamp de "ahora") rompería la reconstrucción
histórica por fecha, que sí es un criterio de aceptación explícito y
verificable. Se preserva la semántica de MySQL; se documenta la lectura
literal ambigua del spec para que quede explícito que no se cambió el
comportamiento a propósito.

**Precio vigente a una fecha (`?fecha=`) en GMT-3 sin la ventana de
tolerancia de 3 horas hardcodeada.** Postgres corre con timezone por
defecto (UTC, no hay `TZ`/`PGTZ` seteado en `docker-compose.yml`), así que
`precioLibroClienteTable.created_at` (`timestamp` sin zona, `defaultNow()`)
guarda instantes en UTC. Para interpretar el `fecha` que llega por query
string como un instante GMT-3 (Argentina), `clienteStock.service.ts` suma 3
horas a `fecha` antes de compararlo contra `created_at`
(`created_at <= fecha + interval '3 hours'`), en vez de restar 3 horas al
`created_at` de cada fila en cada comparación como hacía el
`DATE_SUB(...INTERVAL 3 HOUR)` legado. Es un ajuste de offset equivalente en
efecto (mismo resultado de qué filas caen a un lado u otro del corte) pero
expresado como una conversión de huso horario explícita sobre el input, no
como una tolerancia arbitraria sobre cada fila — de ahí que no sea "lo
mismo" que el código viejo en espíritu, aunque el cálculo sea análogo. La
forma prolija (configurar `TZ=America/Argentina/Buenos_Aires` en el
contenedor de Postgres) queda fuera de alcance (spec, "Datos existentes").

## Riesgos
- **Alcance ampliado respecto del spec original**: borrar
  `cliente.model.ts` obliga a tocar `venta.model.ts`, `transaccion.model.ts`,
  `venta.controller.ts`, `transaccion.controller.ts`, `comprobante.ts`,
  `Afip.ts` y sus tests, módulos que el spec de este feature no menciona
  como afectados. Es una consecuencia directa y necesaria de la decisión del
  usuario, no un descuido, pero implica más superficie de cambio y de
  testing manual/QA de lo que el spec original delimitaba.
- **Regresión funcional real en `venta`/`transaccion`**: después de este
  deploy, los flujos de venta/transacción que mueven stock de cliente
  (consignación y afines) van a fallar con `NotImplemented` en vez de
  funcionar contra MySQL como hoy. Si esos flujos están en uso productivo
  activo, esto es una regresión visible para usuarios reales hasta que
  `venta`/`transaccion` migren — vale la pena confirmar con quien tenga
  contexto de producto si es aceptable en el timing de este deploy, más
  allá de que la decisión técnica ya esté tomada.
- `test/cliente.test.ts`, `test/afip.test.ts`, `test/consignacion.test.ts`,
  `test/venta_consignacion.test.ts` hoy ejercitan (parcial o totalmente) el
  modelo MySQL de `Cliente` y/o los flujos de stock que ahora tiran
  `NotImplemented`; hay que revisar cuáles siguen siendo válidos tal cual,
  cuáles hay que reescribir contra los endpoints Postgres de `cliente`, y
  cuáles pasan a testear explícitamente el nuevo error `NotImplemented` en
  vez de un flujo exitoso. Este plan no decide esa separación fila por fila;
  queda para `sdd-task-breakdown`.
- Alterar la PK de `clientesTable` (tabla con datos reales ya insertados por
  `user.service.ts`) es la primera migración de schema Postgres de este
  proyecto sobre una tabla no vacía; conviene correr la migración generada
  contra una copia de los datos reales antes de aplicarla en el ambiente
  compartido.
- La tabla MySQL `clientes` queda huérfana (sin código que la use) en vez de
  borrarse en este feature (ver "Decisión del usuario"/"Capas afectadas");
  cuando en una etapa posterior se planifique la baja completa de
  `db/migrations/` (MySQL), ese DROP va a ser destructivo e irreversible en
  cuanto a datos — conviene backup de `clientes`/`libro_cliente`/
  `precio_libro_cliente` en ese momento, no en éste.

## Fuera de alcance / deuda aceptada
- No se migra la funcionalidad de `GET /cliente/:id/ventas` a Postgres (spec,
  "No incluye"); la ruta se mantiene registrada pero responde 501
  (`NotImplemented`) en vez de datos reales (ver "Decisiones y trade-offs").
- No se re-implementa `addStock`/`reduceStock`/`haveStock`/`getLibros` (los
  métodos de stock de cliente usados por `venta`/`transaccion`) contra
  Postgres; los call sites quedan tirando `NotImplemented` hasta que
  `venta`/`transaccion` migren (spec, "No incluye").
- No se agrega dual-write ni ningún mecanismo de sincronización entre
  sistemas para `cliente`: la decisión explícita del usuario es cortar por
  lo sano, no mantener nada en paralelo.
- No se migran datos existentes de `libro_cliente`/`clientes`/
  `precio_libro_cliente` de MySQL hacia Postgres; los endpoints de stock de
  este feature arrancan reflejando sólo lo que exista en Postgres (nada,
  hasta que algún flujo nuevo — fuera de este feature — empiece a
  escribir ahí).
- No se escribe la migración MySQL (`_up`/`_down`) que dropea las FKs/
  trigger/tabla `clientes`: queda diferida a cuando se borre toda la
  carpeta `db/migrations/` (MySQL) en una etapa posterior del proyecto
  (ajuste explícito del usuario, ver "Decisión del usuario").
