# Plan: Migrar el módulo `libro` a la nueva arquitectura

## Spec de referencia
specs/002-migrar-libro/spec.md

## Enfoque técnico

Migrar `libro` siguiendo el mismo patrón de capas que `persona` (schema
Drizzle → validator → filter → service con `ServiceBuilder` de `bradb` →
controller → routes), pero con dos diferencias respecto a `persona` que el
propio spec ya señala:

1. `libro.user` sí puede tener una FK real a `usersTable.id` (ya migrado),
   cosa que `personas.user` no pudo tener cuando se migró.
2. El libro pasa a identificarse por `id_libro` generado, con `isbn` como
   valor único (no más PK), lo que exige repensar el modelo de datos de
   `libros` (hoy ya vive parcialmente en Drizzle desde una fase anterior,
   con `id_libro` como PK simple e `is_deleted: boolean` en vez de
   `deleted_at`).

Las tablas `libros`, `precio_libros` y `libros_personas` ya existen como
schemas Drizzle en Postgres desde una fase previa (fase 0, antes de que se
definiera el patrón de PK compuesta `(id, user)` + soft delete vía
`deleted_at` que usa `personas`). Este plan las ajusta a ese patrón en vez
de darlas por buenas tal cual están, porque si no queda una tabla `libros`
con un modelo de aislamiento distinto al resto de las tablas "de un
usuario" del proyecto (deuda que además complicaría migrar `libro_persona`
después, que depende de `libros`).

El alta de un libro (`POST /libro`) **no** toca `libros_personas` ni
`personas` en absoluto (el spec lo dice explícitamente: "el alta de un
libro no toca `libro_persona`"): `libroService.create` sólo inserta en
`librosTable` y `precioLibrosTable`, dentro de una transacción Postgres. La
relación con autores/ilustradores (`librosPersonasTable`, que sí ya está en
Postgres) se resuelve enteramente en **lectura** (`libroService.getPersonas`,
usado por `GET /libro/:isbn`) y en **limpieza** (`libroService.remove`
desasocia al hacer soft delete); la creación/edición de esas asociaciones
queda exclusivamente a cargo del futuro módulo `libro_persona`
(`POST`/`PUT`/`DELETE /libro/:isbn/personas`, fuera de este feature, todavía
en MySQL). No hace falta ningún puente MySQL/Postgres para lectura/limpieza
porque `librosPersonasTable`/`personasTable` ya están las dos en Postgres —
ver "Compatibilidad con módulos no migrados" para el riesgo que sí queda
abierto por esta separación.

La generación del CSV (`GET /libro/lista_libros`) no cambia de mecanismo:
sigue siendo un `fs.writeFileSync` + `res.download` armado a mano a partir
del array de libros ya obtenido con `libroService`; es solo el origen de
los datos el que cambia de MySQL a Postgres.

## Capas afectadas

- schema (Drizzle, `src/schemas/`):
  - `src/schemas/libros.schema.ts`: reescribir `librosTable` (ver "Modelo
    de datos").
  - `src/schemas/precioLibros.schema.ts`: sin cambios de forma, pero pasa a
    ser escrita/leída desde `libro.service.ts` en vez de
    `models/libroPrecio.model.ts`.
  - `src/schemas/librosPersonas.schema.ts`: sin cambios de forma, misma
    situación.
- validator (`src/validators/`):
  - `src/validators/libro.validator.ts`: agregar `libroValidator` (select,
    insert, update, filter, pk) con Drizzle-Zod, análogo a
    `persona.validator.ts`. El body de `POST /libro` se valida directamente
    con `libroValidator.insert` (sin personas): se elimina el schema
    `createLibroConPersonas` que hoy extiende `insert` con
    `autores`/`ilustradores` — no aporta nada una vez que el alta no recibe
    ni crea personas, y no lo usa nadie más que
    `libro.controller.ts#create` (verificado, ver "Decisiones y
    trade-offs"). Conservar los schemas viejos (`createLibro`/`updateLibro`/
    `libroSchema`/`libroParams`/etc.) documentados como "en baja" hasta que
    se puedan borrar (siguen siendo el modelo de referencia de
    `libro.model.ts`/`libroPrecio.model.ts`, aunque a la fecha de este plan
    ya no los importa ningún controller — ver nota en "Riesgos" sobre
    limpiarlos en una pasada aparte, fuera de alcance de este feature).
  - Nuevo `src/validators/libroPrecio.validator.ts` (select/insert vía
    `precioLibrosTable`), análogo a como `libro_persona.validator.ts` es
    hoy un archivo aparte del de `libro`.
- filter (`src/filters/`):
  - Nuevo `src/filters/libro.filter.ts`: filtro por `user` (siempre,
    aislamiento) + filtros de texto (`titulo` con `ilike`) y exactos
    (`isbn`, `precio`, `stock`) sobre columnas de `librosTable`, análogo a
    `libroParams` actual pero expresado como `FilterMap`.
- service (`src/services/`):
  - `src/services/libro.service.ts` (nuevo): `findOne`, `findAllFiltered`
    (no paginado, con filtros), `findAllPaginated` (paginado, sin
    filtros — ver "Decisiones y trade-offs" sobre por qué siguen siendo
    dos caminos separados), `create` (transacción Postgres con **sólo**
    `librosTable` + `precioLibrosTable`: inserta el libro y su registro de
    precio inicial; no toca `personasTable` ni `librosPersonasTable` — sin
    tipos `PersonaRef`/`esPersonaExistente`/`esPersonaNueva` ni la lógica de
    validar/crear personas existentes o nuevas que tenía una versión previa
    de este service, ver "Riesgos" para el motivo de mencionarlo
    explícitamente), `update` (libro + precio nuevo si cambió), `remove`
    (soft delete + desasociar personas, sin cambios), `exists` (duplicado
    de isbn activo por usuario), `getPersonas` (autores/ilustradores de un
    libro, sin cambios, sigue leyendo `librosPersonasTable`), `getPrecios`
    (historial).
  - `src/services/libroPrecio.service.ts` (nuevo, delgado): builder de
    `precioLibrosTable` + `getByIsbn` ordenado por `created_at desc` (no
    hay `id` propio del negocio para ordenar por antigüedad de forma
    legible, se ordena por fecha de creación en vez de por id descendente
    como hace hoy `LibroPrecio.getPreciosLibro`).
- controller (`src/controllers/`):
  - `src/controllers/libro.controller.ts`: reescribir completamente sobre
    `libroService` (Postgres), sacando `Libro`, `LibroPrecio`, `Persona`
    (modelos MySQL) y `conn`. El handler `create` valida el body con
    `libroValidator.insert` (no `createLibroConPersonas`), no desestructura
    `autores`/`ilustradores` del `req.body`, y llama a
    `libroService.create(libroBody, userId)` con el libro solo — si el
    cliente manda `autores`/`ilustradores` en el body de `POST /libro`, Zod
    los descarta sin error (`insert` no los declara), consistente con que
    ya no es responsabilidad de este endpoint. Se elimina el handler
    `getVentas` (fuera de alcance) y el `router.get('/:isbn/ventas'`
    correspondiente.
- routes (`src/routes/`):
  - `src/routes/libro.routes.ts`: sacar la ruta de ventas; sacar el
    middleware `transactional` (MySQL, `res.locals.connection`) de
    `POST /` — el nuevo `libroService.create` maneja su propia transacción
    Postgres con `db.transaction`, análoga a `userService.createUser`.
- tests (`test/`):
  - `test/libro.test.ts`: adaptar a la nueva forma de datos (`id_libro`
    generado en la respuesta, sin `id_libro` en el body de alta) y sacar
    los tests de `GET /libro/:isbn/ventas`. El body de `POST /libro` en los
    tests deja de mandar `autores`/`ilustradores`; los tests que hoy
    verifican que el libro creado trae autores/ilustradores dejan de tener
    sentido para `POST /libro` (pasan a ser responsabilidad de los tests de
    `libro_persona`, cuando ese módulo migre) — lo que sí hay que cubrir es
    que `GET /libro/:isbn` de un libro recién creado devuelve
    `autores`/`ilustradores` vacíos. Mismo patrón de limpieza que
    `persona.test.ts` (hard delete directo contra Postgres al final, en
    vez de contra `conn`/MySQL).

## Modelo de datos

`librosTable` (`src/schemas/libros.schema.ts`), reescrita:

- `id_libro`: `integer().generatedAlwaysAsIdentity()`. Dos cambios respecto
  a la versión actual: deja de ser `primaryKey()` simple (pasa a formar
  parte de la PK compuesta, ver abajo) y se le agrega `.unique()` — igual
  que `personasTable.id` — porque `librosPersonasTable.id_libro`,
  `precioLibrosTable.id_libro` y `libroClienteTable.id_libro` ya referencian
  esta columna sola con `.references()`, y Postgres exige que la columna
  referenciada por una FK sea única por sí misma, no solo parte de una PK
  compuesta.
- `user`: se mantiene la FK real a `usersTable.id` que ya tiene hoy (esto
  ya estaba bien resuelto en la fase 0, es lo que el spec señala como
  diferencia con `personas`).
- PK compuesta `primaryKey({ columns: [id_libro, user] })`, igual que
  `personasTable`: mismo motivo (bradb arma el `WHERE` de
  `findOne`/`update`/`delete` a partir de todas las columnas de la PK, así
  que esto hace estructuralmente imposible traer/editar/borrar un libro de
  otro usuario, sin depender de un chequeo aparte en el service).
- `is_deleted: boolean` se reemplaza por `deletedAt: timestamp("deleted_at")`
  nullable, igual que `personasTable.deletedAt`. Es necesario para que
  `ServiceBuilder` reconozca soft delete automáticamente: `bradb` detecta
  soft delete buscando una columna llamada exactamente `deleted_at`
  (`haveSoftDelete()` en `bradb/src/service.ts`); con `is_deleted` como
  está hoy, `ServiceBuilder` haría *hard* delete y no filtraría
  eliminados en `findOne`/`findAll` automáticamente. Esto es un cambio de
  columna real (no solo de tipo), así que requiere backfill en la
  migración (`is_deleted = true` → `deleted_at = now()`, `is_deleted =
  false` → `deleted_at = null`) antes de dropear `is_deleted`.
- `isbn`: se agrega un índice único parcial
  `uniqueIndex("libros_isbn_user_active_idx").on(isbn, user).where(sql`deleted_at IS NULL`)`.
  Ver "Decisiones y trade-offs" para por qué un constraint parcial y no
  solo una validación de aplicación.

`precioLibrosTable` y `librosPersonasTable`: sin cambios de columnas. Sus
FKs a `librosTable.id_libro` siguen siendo válidas porque esa columna sigue
siendo `.unique()` después del cambio de PK.

Migración: se genera con `npm run db:generate` (drizzle-kit) a partir del
schema nuevo; como cambia el tipo de una columna existente (`is_deleted` →
`deleted_at`) con datos existentes, el SQL generado por drizzle-kit hay que
completarlo a mano en `db/migrations_pg/` con el backfill antes de
dropear `is_deleted`, siguiendo el mismo criterio que ya haya quedado
documentado (si lo hay) en las migraciones previas de este directorio para
cambios de columna con datos.

## Compatibilidad con módulos no migrados

- `libro_persona` (endpoints `POST`/`PUT`/`DELETE /libro/:isbn/personas`,
  `src/controllers/libro_persona.controller.ts`,
  `src/models/libro_persona.model.ts`) sigue leyendo/escribiendo
  `libros_personas` **en MySQL**, una tabla distinta de
  `librosPersonasTable` en Postgres que `libro.service.ts` usa para
  **leer** (`getPersonas`, desde `GET /libro/:isbn`) y **limpiar**
  (`remove`, al eliminar un libro). El spec simplificó el alta de un libro
  para que `POST /libro` no cree ninguna asociación autor/ilustrador (eso
  queda exclusivamente a cargo de `libro_persona`), así que el riesgo de
  que queden asociaciones "huérfanas" en `libros_personas` (MySQL) por
  altas hechas desde el nuevo `POST /libro` **no aplica**: el endpoint
  migrado nunca escribe ahí porque nunca escribe autores/ilustradores en
  absoluto.
  El riesgo que sí queda vigente, y es nuevo respecto de plans anteriores
  de este mismo feature, es otro: todo libro dado de alta a través del
  `POST /libro` migrado nace **sin** autores ni ilustradores en Postgres
  (`librosPersonasTable` vacío para ese `id_libro`), y la única forma de
  asociarle alguno son los endpoints `/libro/:isbn/personas`, que **siguen
  sin migrar** y operan contra MySQL. Como MySQL y Postgres son bases
  distintas, esos endpoints no van a poder resolver la asociación contra un
  libro que sólo existe en Postgres (o, si intentan resolverla contra su
  propia copia MySQL de `libros`/`libros_personas`, la asociación quedaría
  en una tabla que `GET /libro/:isbn` migrado ya no lee). En la práctica,
  después de este feature, todo libro nuevo queda sin autores/ilustradores
  utilizables hasta que `libro_persona` también migre a Postgres (la etapa
  siguiente, según el spec). Se documenta como riesgo aceptado, mismo
  criterio que ya se usó en la migración de `user`: no se intenta mantener
  ambas bases sincronizadas ni tender un puente temporal entre ellas.
- `liquidacion`, `cliente` (alta/consulta, todavía en `models/cliente.model.ts`
  sobre MySQL) y `venta`/`transaccion` también leen/escriben `libros`,
  `precio_libros` y/o `libros_personas` **en MySQL**. A partir de este
  feature, esas tablas MySQL dejan de recibir altas/bajas/ediciones de
  libros (todo pasa a Postgres), por lo que quedan progresivamente
  desactualizadas respecto a Postgres. Cualquier lectura desde
  `liquidacion`/`cliente`/`venta` sobre libros creados después de esta
  migración va a fallar o devolver datos viejos/vacíos. Es el mismo tipo
  de divergencia que ya introdujo la migración de `persona` sobre estos
  mismos módulos, y se acepta por la misma razón: el objetivo de esta
  etapa es avanzar la migración módulo por módulo, no evitar romper lo que
  todavía no migró (explícito en el spec, sección "No incluye").
- `libro_persona.controller.ts` sigue importando validators viejos de
  `libro.validator.ts` (`createLibro`, `updateLibro` indirectamente vía
  `libroSchema`) y modelos viejos de `libro.model.ts`
  (`Libro`/`LibroPrecio`). Este feature **no puede borrar**
  `libro.model.ts` ni los validators/tipos viejos de golpe: hay que
  revisar primero qué sigue usando `libro_persona.controller.ts` de esos
  archivos y dejarlos vivos (marcados como "en baja", mismo criterio que
  ya usa `persona.validator.ts` con sus "Validators viejos") hasta que
  `libro_persona` migre.

## Decisiones y trade-offs

- **`create` no crea ni valida personas, ni siquiera cuando llegan en el
  body**: se elimina de `libro.service.ts` toda la lógica que hoy resuelve
  autores/ilustradores en el alta (tipos `PersonaExistenteRef`/
  `PersonaNuevaRef`/`PersonaRef` y las funciones `esPersonaExistente`/
  `esPersonaNueva`, la búsqueda de personas existentes por id, la
  detección de dni duplicado para personas nuevas, el insert en
  `personasTable` y en `librosPersonasTable`); `create` pasa a insertar
  sólo en `librosTable` y `precioLibrosTable`. Es una consecuencia directa
  del spec ("el alta de un libro no toca `libro_persona` en absoluto"), no
  una decisión de diseño libre: se documenta igual porque cambia la forma
  del código de una versión previa de este mismo plan, para que quede
  explícito qué se saca y por qué, no sólo qué queda. Se gana un `create`
  mucho más simple y una responsabilidad única por endpoint (alta de libro
  vs. asociación de personas, cada una en su propio módulo); se pierde la
  comodidad de dar de alta un libro con sus autores en una sola llamada
  (ahora son dos: `POST /libro` y, cuando exista, `POST
  /libro/:isbn/personas`) — trade-off que ya asume el spec, no este plan.
- **`createLibroConPersonas` se borra en vez de dejarse "en baja"**: a
  diferencia de los schemas viejos de MySQL (`createLibro`/`libroSchema`/
  etc.), que siguen vivos porque otro módulo sin migrar
  (`libro_persona.controller.ts`) todavía los usa, `createLibroConPersonas`
  es un schema Postgres/Drizzle-Zod que sólo existía para el body de
  `POST /libro` y no lo usa ningún otro archivo (verificado por búsqueda
  en `src/`). Dejarlo vivo sería código muerto sin ninguna razón de
  compatibilidad que lo justifique (no es el caso de los schemas viejos de
  MySQL, que sí tienen un consumidor real). Se borra, y `POST /libro` pasa
  a validar su body directamente con `libroValidator.insert`.
- **PK compuesta `(id_libro, user)` + FK real a `usersTable`**: a
  diferencia de `personas` (que no pudo tener FK real porque `user` seguía
  en MySQL), acá se puede tener las dos cosas a la vez porque no son
  excluyentes: la FK garantiza integridad referencial (no se puede crear
  un libro con un `user` que no existe), la PK compuesta garantiza
  aislamiento estructural en las queries de bradb (no se puede traer un
  libro de otro usuario ni por error de query). Se gana defensa en
  profundidad; se pierde nada relevante (el mismo patrón ya está probado
  en `personas`). Alternativa descartada: PK simple `id_libro` + chequeo
  manual de `user` en cada query del service, como hacía `Libro.getByIsbn`
  en MySQL — se descarta porque ya se demostró en `persona` que es más
  fácil de romper por accidente (un desarrollador nuevo puede escribir un
  `findOne` sin el filtro de `user` y no se nota hasta producción).
- **Índice único parcial (`isbn`, `user`) `WHERE deleted_at IS NULL`, además
  de la validación de aplicación (`libroService.exists`)**: `persona` no
  tiene un equivalente (el dni no es único ahí a nivel de constraint, solo
  se valida en el service vía `personaService.exists`). Para `libro` se
  agrega el constraint de base además de la validación de aplicación
  porque este spec convierte explícitamente al isbn en "valor único" como
  parte central del cambio (antes, la unicidad la garantizaba isbn siendo
  la PK; ahora no hay ningún constraint de PK que la reemplace si no se
  agrega uno). Se gana protección real contra condición de carrera (dos
  altas concurrentes con el mismo isbn no pueden generar dos filas
  activas, cosa que una validación `exists()` de aplicación sola no
  garantiza). Se pierde algo de uniformidad con el patrón de `persona`
  (que solo usa `exists()`), y hay que mapear el error de violación de
  constraint (`Duplicated` vía `bradb`'s `handleSqlError`, que ya detecta
  `duplicate key` y lanza `ServiceError` 409) a la respuesta esperada —
  `libroService.create` sigue llamando primero a `exists()` para devolver
  el mismo mensaje/forma de error que hoy en el camino no concurrente, y
  deja que el constraint sea la red de seguridad para el caso de carrera.
- **`GET /libro` con filtros y `GET /libro?page=` como dos funciones de
  service separadas (`findAllFiltered`/`findAllPaginated`) en vez de una
  sola con soporte combinado**: se mantiene el comportamiento actual (no
  combinables) porque el spec lo pide explícitamente ("Preguntas
  abiertas" ya resueltas con el default). Se modela como dos funciones en
  vez de una porque `ServiceBuilder.findAll` de `bradb` ya distingue en su
  firma entre modo paginado y no paginado (`findAll(false)` vs
  `findAll(true)`, ver `persona.service.ts` con `findAllRaw =
  builder.findAll(false)`); forzar un solo camino que combine ambos
  requeriría lógica ad hoc dentro del service que el propio spec dice que
  no hace falta. El controller decide cuál llamar igual que hoy
  (`"page" in req.query`).
- **Orden de `GET /libro` por `titulo` vía `select().orderBy(...)`
  custom**: `ServiceBuilder.findAll` no expone una opción de `orderBy` en
  su firma pública; se resuelve pasándole a `findAll` un `select` custom
  (`() => db.select().from(librosTable).orderBy(librosTable.titulo).$dynamic()`)
  igual que hace `user.service.ts` con `selectWithoutPassword` para omitir
  `password`. Se gana no tener que tocar `bradb`; se pierde que el orden
  queda hardcodeado en el service en vez de ser parametrizable, pero es
  exactamente el comportamiento actual (`ORDER BY titulo ASC`).
- **`libroPrecio.service.ts` separado de `libro.service.ts`**: mismo
  criterio de separación por tabla/responsabilidad que ya existe entre
  `persona.service.ts` y el resto (una tabla, un service). `libro.service.ts`
  la usa como dependencia (recibe/llama sus funciones), no la reimplementa.
- **`create` como una única transacción Postgres (`db.transaction`) en el
  service, no en el controller vía middleware**: se elimina el middleware
  `transactional` (que abría una transacción MySQL y la exponía en
  `res.locals.connection` para que el controller/modelos la fueran
  pasando a mano) porque ya no aplica a Postgres/Drizzle, y porque el
  patrón que ya usa `userService.createUser` (transacción completa dentro
  del service, con `tx.insert(...)` encadenados) resuelve lo mismo sin
  necesidad de pasar la conexión a través de capas. Ver
  `db.transaction` en `userService.createUser` como referencia directa.
  Con la simplificación de este plan, la transacción de `libro.service.ts#create`
  queda con sólo dos pasos (`tx.insert(librosTable)` +
  `tx.insert(precioLibrosTable)`), más chica que la de una versión previa
  de este mismo plan (que también insertaba personas y asociaciones
  dentro de la misma transacción); el criterio de fondo no cambia: todo lo
  que el spec pide atómico para el alta (libro + precio inicial) entra en
  la misma transacción Postgres, y no hay ningún paso posterior de
  filesystem/AFIP como sí tiene `userService.createUser`, así que no hace
  falta el patrón de compensación manual que usa `user.controller.ts`.

## Riesgos

- El cambio de `is_deleted` (boolean) a `deleted_at` (timestamp) en una
  tabla con datos existentes es una migración con backfill, no solo un
  cambio de schema declarativo; si el backfill queda mal escrito, libros
  ya eliminados podrían "resucitar" (quedar con `deleted_at IS NULL`) o
  viceversa. Revisar el SQL generado a mano antes de aplicarlo, no confiar
  en que `drizzle-kit generate` lo resuelva solo.
- Todo libro dado de alta después de este feature nace sin autores ni
  ilustradores y no tiene, dentro de este feature, ninguna forma
  funcional de conseguirlos (ver "Compatibilidad con módulos no
  migrados"): si alguien depende hoy de poder cargar un libro con sus
  autores en un solo paso (`POST /libro` con `autores`/`ilustradores` en
  el body, como acepta la implementación actual pre-migración), es un
  cambio de comportamiento observable real para quien integra contra la
  API, no solo un detalle interno — aunque el spec lo pide explícitamente,
  vale la pena que quede remarcado acá para quien lea sólo el plan.
- Al sacar la lógica de personas de `create`, quedan en `libro.service.ts`
  imports que hay que revisar que no sobrevivan sin uso:
  `CreateLibroPersona`/`CreateLibroPersonaInDB` (de
  `libro_persona.validator.ts`) y `inArray` (de `drizzle-orm`) sólo los
  usaba la lógica de personas que se elimina; si no queda ningún otro uso
  dentro del archivo, hay que sacar esos imports (lint/TS los marcaría
  como no usados, pero es fácil pasarlos por alto en un diff grande). El
  resto de `libro_persona.validator.ts` no se toca: `CreateLibroPersona`/
  `CreateLibroPersonaInDB` siguen usándose en el schema viejo `createLibro`
  de `libro.validator.ts` (el de MySQL, todavía "en baja" porque
  `libro_persona.controller.ts` depende indirectamente de ese bloque), así
  que el tipo en sí no queda huérfano — esto es sólo sobre el import
  puntual que `libro.service.ts` deja de necesitar.
- Los validators/tipos viejos de `libro.validator.ts` (`createLibro`,
  `updateLibro`, `libroSchema`, `libroParams`, etc., el bloque marcado
  "Validators viejos") no se pueden borrar en este feature porque son el
  modelo de referencia declarado de `libro.model.ts`/`libroPrecio.model.ts`
  y de `libro_persona.controller.ts` (no migra en este feature); dejarlos
  duplicados junto a los nuevos (`libroValidator`) es deuda aceptada
  explícita, igual que ya documenta `persona.validator.ts`. Al revisar el
  código actual para este plan se notó que, a la fecha, ningún controller
  importa ya `createLibro`/`libroSchema`/`libroParams` directamente (sólo
  quedan referenciados entre sí dentro del propio archivo); antes de
  asumir que están realmente muertos hay que revisar si `libro.model.ts`/
  `libro_persona.controller.ts` los siguen necesitando de forma indirecta
  — si no, es limpieza para una pasada aparte, fuera de alcance de este
  feature (no se toca acá para no mezclar la simplificación del alta con
  una limpieza de deuda no pedida).

## Fuera de alcance / deuda aceptada

- `GET /libro/:isbn/ventas` se elimina (handler y ruta), según el spec.
- Migrar `libro_persona` (`POST`/`PUT`/`DELETE /libro/:isbn/personas`)
  queda para la siguiente etapa; sus endpoints siguen andando contra
  MySQL tal cual están, y son la única forma de asociar autores/
  ilustradores a un libro (ver "Compatibilidad con módulos no migrados"
  para el gap de datos que esto deja para libros creados vía el nuevo
  `POST /libro`).
- No se toca `cliente`, `liquidacion`, `transaccion`, `venta`.
- No se agrega soporte para combinar filtros y paginación en `GET /libro`,
  ni ningún cambio de comportamiento observable más allá del id generado
  y de que `POST /libro` deja de aceptar `autores`/`ilustradores` en el
  body (este último ya forma parte del comportamiento esperado según el
  spec, no es una regresión de este plan).
- No se limpian en este feature los validators/tipos viejos de
  `libro.validator.ts` que ya no importa ningún controller (ver
  "Riesgos"); se documenta la observación pero la limpieza queda fuera de
  alcance para no mezclarla con la simplificación del alta.
</content>
