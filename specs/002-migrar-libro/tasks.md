# Tasks: Migrar el módulo `libro` a la nueva arquitectura

Plan de referencia: specs/002-migrar-libro/plan.md
Spec de referencia: specs/002-migrar-libro/spec.md

Cada tarea es chica, verificable de forma independiente, y en orden de dependencia.
Marcar `[x]` al completarla y agregar una línea con lo que efectivamente se hizo
si difiere del enunciado.

Nota general sobre el schema/migración: la tabla `libros` en Postgres está
vacía hoy (ningún módulo escribe ahí todavía; `libro` es el primero en
usarla de verdad), aunque el schema Drizzle ya existiera declarativamente
desde una fase anterior. El cambio `is_deleted` (boolean) → `deleted_at`
(timestamp) NO necesita backfill de datos existentes ni UPDATE alguno: es
solo un cambio de schema declarativo sobre una tabla sin filas. Ignorar
cualquier mención a backfill en el plan para esta parte.

- [x] T1. Reescribir `src/schemas/libros.schema.ts`: `librosTable` con
  `id_libro: integer("id_libro").generatedAlwaysAsIdentity().unique()` (deja
  de ser `primaryKey()` simple), `user` mantiene la FK real a
  `usersTable.id` que ya tiene hoy, PK compuesta
  `primaryKey({ columns: [id_libro, user] })` (mismo patrón que
  `personasTable`, ver `src/schemas/personas.schema.ts`), reemplazar
  `is_deleted: boolean` por `deletedAt: timestamp("deleted_at")` nullable
  (así `bradb`'s `ServiceBuilder` detecta soft delete automáticamente), y
  agregar el índice único parcial
  `uniqueIndex("libros_isbn_user_active_idx").on(isbn, user).where(sql\`deleted_at IS NULL\`)`.
  No tocar `precioLibrosTable` ni `librosPersonasTable` (sus FKs a
  `librosTable.id_libro` siguen siendo válidas porque esa columna sigue
  siendo `.unique()`).

- [x] T2. Generar y aplicar la migración: correr `npm run db:generate`
  (drizzle-kit) a partir del schema nuevo y revisar el SQL resultante en
  `db/migrations_pg/`. Al ser una tabla vacía, el SQL esperado es
  DROP/ADD de columnas e índices sin ningún `UPDATE`/backfill — si
  drizzle-kit genera algo que intente preservar o migrar datos de
  `is_deleted`, se puede simplificar a mano porque no hace falta. Aplicar
  la migración contra la base de desarrollo/test.
  - `drizzle-kit generate` es interactivo (pregunta si `deleted_at` es una
    columna nueva o un rename de `is_deleted`) y este sandbox no tiene TTY;
    se resolvió corriéndolo dentro de un pty real (`pty.openpty`, script de
    Python descartable en el scratchpad) para poder aceptar la opción
    default ("create column", que es el DROP+ADD esperado). Se generó
    `db/migrations_pg/0001_overconfident_chronomancer.sql`; se corrigió a
    mano el nombre del constraint de la PK vieja (`libros_pkey`, que
    drizzle-kit no pudo resolver solo, ver comentario dejado en el SQL) para
    que el `DROP CONSTRAINT` sea válido. No contiene ningún `UPDATE`, tal
    como esperaba la nota general del archivo.
  - **No se pudo aplicar** (`db:migrate`/`drizzle-kit migrate`) contra
    ninguna base: este entorno no tiene Postgres del proyecto disponible
    (el Postgres del puerto 5432 de esta máquina es de otro proyecto). Falta
    correr `npm run db:migrate` contra la base de desarrollo/test real antes
    de dar por buena la migración en un entorno con DB.

- [x] T3. Agregar `libroValidator` (nuevo, Postgres/Drizzle) a
  `src/validators/libro.validator.ts`, análogo a `personaValidator` en
  `src/validators/persona.validator.ts`:
  - `select = createSelectSchema(librosTable)`
  - `insert = createInsertSchema(librosTable).omit({ user: true, deletedAt: true })`
  - `update = insert.partial()`
  - `filter`: objeto parcial con `user: z.number()`, `isbn: z.string()`,
    `titulo: z.string()`, `precio: z.coerce.number()`,
    `stock: z.coerce.number()` — `precio`/`stock` usan `z.coerce.number()`
    porque llegan como query params (string) en `GET /libro`, a diferencia
    de `personaValidator.filter` que solo tiene `user`.
  - `pk = createPkSchema(librosTable).pick({ id_libro: true })`
  - Agregar además un schema combinado para el body de `POST /libro`
    (p.ej. `createLibroConPersonas = libroValidator.insert.extend({ autores:
    z.array(createlibroPersonaInDB.or(createLibroPersona)), ilustradores:
    z.array(createlibroPersonaInDB.or(createLibroPersona)) })`, reusando
    `createlibroPersonaInDB`/`createLibroPersona` que ya existen en
    `src/validators/libro_persona.validator.ts`).
  Dejar los schemas viejos del archivo (`createLibro`, `updateLibro`,
  `libroSchema`, `libroParams`, `libroCantidad`, `libroPrecio`/
  `CreateLibroPrecio`, etc.) intactos y agregar un comentario "en baja"
  igual al de `persona.validator.ts`, documentando que siguen siendo
  usados por `libro_persona.controller.ts`, `src/models/libro.model.ts` y
  `src/models/libroPrecio.model.ts` (no migran en este feature).

- [x] T4. Crear `src/validators/libroPrecio.validator.ts` (nuevo, análogo a
  como `libro_persona.validator.ts` es hoy un archivo aparte del de
  `libro`): `select = createSelectSchema(precioLibrosTable)`,
  `insert = createInsertSchema(precioLibrosTable).omit({ id: true,
  created_at: true })`.
  - Se implementó `insert = createInsertSchema(precioLibrosTable)` sin
    `.omit(...)`: drizzle-zod ya excluye del insert schema las columnas
    `generatedAlwaysAsIdentity()` (`id`) y con default (`created_at`) sin
    necesidad de omitirlas a mano (mismo criterio que `usersTable.id` en
    `user.validator.ts`); `.omit({id: true})` tira error de tipo porque `id`
    ya no es una key del schema generado.

- [x] T5. Crear `src/filters/libro.filter.ts`: `FilterMap` para
  `libroValidator.filter` con `user: eq(librosTable.user, val)` (aislamiento,
  siempre presente), `isbn: eq(librosTable.isbn, val)`,
  `titulo: ilike(librosTable.titulo, \`%${val}%\`)`,
  `precio: eq(librosTable.precio, val)`, `stock: eq(librosTable.stock, val)`.
  Análogo a `src/filters/persona.filter.ts` pero con más columnas.

- [x] T6. Crear `src/services/libroPrecio.service.ts` (nuevo, delgado):
  `builder = new ServiceBuilder(db, precioLibrosTable, ...)` (sin filtros
  propios, no expone `findAll` genérico), `insert` vía `builder.create()` (o
  `db.insert` directo si `ServiceBuilder` no encaja para este uso), y
  `getByIsbn(isbn: string, userId: number)`: select de `precioLibrosTable`
  filtrado por `isbn` y `user`, ordenado por `created_at desc` (no hay `id`
  propio del negocio para ordenar por antigüedad de forma legible, a
  diferencia de `LibroPrecio.getPreciosLibro` en MySQL que ordena por `id
  DESC`).

- [x] T7. Crear `src/services/libro.service.ts` — parte 1 (lectura por
  isbn): `builder = new ServiceBuilder(db, librosTable, libroFilterMap)`.
  Los endpoints públicos siguen recibiendo `isbn` en la URL, no `id_libro`
  (que ahora es interno), así que hace falta una función propia de
  búsqueda por isbn, distinta del `findOne(pk)` que arma `bradb` (ese
  necesita `id_libro`): `findOne(isbn: string, userId: number)` — select
  de `librosTable` filtrado por `isbn`, `user` y `deletedAt IS NULL`; si no
  hay filas, throw `NotFound` (`src/models/errors.ts`). También
  `exists(isbn: string, userId: number): Promise<boolean>` (duplicado de
  isbn activo por usuario), análogo a `personaService.exists`.

- [x] T8. `libro.service.ts` — parte 2 (listados): `findAllFiltered(filters:
  LibroFilter)`: `builder.findAll(false)` con un `select` custom que agrega
  `orderBy(librosTable.titulo)` (igual que `user.service.ts` con
  `selectWithoutPassword`, ver plan "Decisiones y trade-offs"); recibe los
  filtros ya con `user` incluido y devuelve los libros no eliminados del
  usuario que matchean. `findAllPaginated(userId: number, page: number)`:
  `builder.findAll(true)` sin `select` custom (sin `ORDER BY` explícito,
  igual que el `Libro.getPaginated` actual), filtrado solo por `user`, 10
  libros por página. Filtros y paginación siguen siendo dos caminos
  separados, no combinables (ver plan).

- [x] T9. `libro.service.ts` — parte 3 (`create`): `create(data:
  LibroInsert & { autores: ..., ilustradores: ... }, userId: number)` como
  una única `db.transaction` (`tx`), siguiendo el patrón de
  `userService.createUser` en `src/services/user.service.ts` (todos los
  `tx.insert(...)` encadenados directo sobre las tablas, no reusando otros
  services que están atados a `db`):
  1. `tx.insert(librosTable).values({...libroBody, user: userId}).returning()`.
  2. Para autores/ilustradores referenciados por id: verificar que existan
     para `userId` (select en `personasTable` dentro de la `tx`); si falta
     alguno, throw error (deja que la `tx` haga rollback automático).
  3. Para autores/ilustradores nuevos (sin id): verificar que no exista ya
     una persona con ese dni para `userId` (select en `personasTable`
     dentro de la `tx`); si existe, throw error. Si no, `tx.insert(personasTable)`.
  4. `tx.insert(precioLibrosTable)` con el precio inicial.
  5. `tx.insert(librosPersonasTable)` con las asociaciones (autores +
     ilustradores, con su `tipo` y `porcentaje`).
  6. Devolver `{ ...libro, autores, ilustradores }`.
  El caller (`libroService.create`, llamado por el controller) sigue
  llamando primero a `exists()` (fuera de la transacción) para devolver el
  mismo mensaje de error que hoy en el caso no concurrente; el índice
  único parcial de T1 es la red de seguridad para el caso de carrera (el
  error de constraint lo mapea `bradb`'s `handleSqlError` a `ServiceError`
  409, ver plan).
  - No se replicó la función `removeDuplicateds` del `libro.controller.ts`
    viejo (filtraba por `isbn`, que es el mismo valor para todas las
    entradas de personas de un mismo libro, así que en la práctica sólo
    dejaba pasar la primera persona por-id de la lista completa, sin
    importar cuántas se mandaran): no es un comportamiento que el spec pida
    preservar (nada en "Comportamiento esperado"/"Casos borde" sugiere que
    sólo se pueda asociar un autor/ilustrador por id), ni algo que plan/T9
    mencionen replicar; se trata como un bug del código viejo, no como
    comportamiento observable a mantener.

- [x] T10. `libro.service.ts` — parte 4 (`update`): `update(isbn: string,
  userId: number, body: LibroUpdate)`: resolver el libro actual con
  `findOne(isbn, userId)` (T7) para obtener su `id_libro` y precio vigente;
  si `body.precio` está presente y difiere del precio actual, insertar un
  registro nuevo en el historial vía `libroPrecioService.insert` (T6) antes
  de actualizar; luego `builder.update({ id_libro, user: userId }, body)`
  (la PK compuesta hace que esto tire `NotFound` si el libro es de otro
  usuario, sin chequeo aparte). Devolver el libro actualizado.

- [x] T11. `libro.service.ts` — parte 5 (`remove`): `remove(isbn: string,
  userId: number)`: resolver el libro con `findOne(isbn, userId)` (T7) para
  obtener su `id_libro`; borrar (hard delete) las filas de
  `librosPersonasTable` con ese `id_libro` (desasociar autores/ilustradores
  actuales, igual que hace hoy `Libro.delete` vía `LibroPersona._delete`);
  luego `builder.delete({ id_libro, user: userId })` (soft delete, setea
  `deleted_at`).

- [x] T12. `libro.service.ts` — parte 6 (`getPersonas`, `getPrecios`):
  `getPersonas(isbn: string, userId: number)`: resolver `id_libro` con
  `findOne` (T7), luego join de `librosPersonasTable` + `personasTable`
  filtrado por `id_libro` (y `personasTable.user = userId`), devolviendo
  `{ autores, ilustradores }` separados por `tipo` (cada persona con al
  menos `id`, `dni`, `nombre`, `email`, `porcentaje`, `tipo` — ver criterio
  de aceptación de `GET /libro/:isbn` en el spec). `getPrecios(isbn: string,
  userId: number)`: delega en `libroPrecioService.getByIsbn(isbn, userId)`
  (T6), ya viene ordenado del más reciente al más antiguo. Exportar
  `libroService` con todas las funciones de T7-T12.

- [x] T13. Reescribir `src/controllers/libro.controller.ts` sobre
  `libroService` (y `libroValidator`/`createLibroConPersonas` de T3):
  sacar los imports de `Libro`, `LibroPrecio`, `Persona` (modelos MySQL) y
  `conn`. `create`: parsear body con `createLibroConPersonas`, separar
  `autores`/`ilustradores`, llamar `libroService.exists` +
  `libroService.create`, responder 201. `update`: parsear
  `libroValidator.update`, llamar `libroService.update(isbn, userId, body)`,
  responder 201. `remove`: `libroService.remove(isbn, userId)`, responder
  200. `getOne`: `libroService.findOne` + `libroService.getPersonas`,
  responder con `{ ...libro, autores, ilustradores }`. `getAll`: si `"page"
  in req.query` usar `libroService.findAllPaginated`, si no parsear
  `libroValidator.filter` desde `req.query` (agregando `user: userId`) y
  usar `libroService.findAllFiltered`. `getPrecios`: `libroService.getPrecios`.
  `listaLibros`: igual mecanismo actual (`fs.writeFileSync` + `res.download`)
  pero alimentado por `libroService.findAllFiltered({ user: userId })` en
  vez de `Libro.getAll`. Eliminar el handler `getVentas` por completo (fuera
  de alcance según el spec). No tocar `libro_persona.controller.ts`.

- [x] T14. Ajustar `src/routes/libro.routes.ts`: sacar la ruta
  `GET /:isbn/ventas` (y su import de `getVentas` si quedó suelto); sacar
  el middleware `transactional` de `POST /` (el nuevo
  `libroService.create` maneja su propia transacción Postgres con
  `db.transaction`, no necesita `res.locals.connection` de MySQL). No
  tocar las rutas `/:isbn/personas` (siguen usando
  `LibroPersonaController`, sin migrar).

- [x] T15. Adaptar `test/libro.test.ts` a la nueva forma de datos:
  - Hard delete inicial: reemplazar las queries `conn.query(DELETE FROM
    libros_personas/precio_libros/libros WHERE isbn=...)` (MySQL) por
    deletes directos contra Postgres con `db` (`src/pgDb.ts`) sobre
    `librosPersonasTable`, `precioLibrosTable` y `librosTable` filtrando por
    `isbn`, y sobre `personasTable` filtrando `dni='39019203'` — mismo
    patrón de limpieza que ya usa `test/persona.test.ts` para lo que migró
    a Postgres, pero contra Postgres en vez de MySQL/`conn`.
  - `POST /libro/`: mandar `autores`/`ilustradores` en el mismo body de
    alta (ya lo hace el test actual), verificar 201 con `id_libro` generado
    en la respuesta (sin `id_libro` en el body de alta) y que
    `res.body.data` tenga `autores`/`ilustradores` ya poblados desde la
    creación.
  - Sacar del archivo los tests que dependen de
    `POST`/`PUT`/`DELETE /libro/:isbn/personas` (los describe blocks
    "Insertar la misma persona que antes", "Agregar personas", "Actualizamos
    una persona", "Actualizamos una persona que no esta en el libro",
    "Borrar una persona del libro", "Intentar Borrar una persona que no
    trabaja en el libro"): esos endpoints siguen sin migrar sobre MySQL, y
    las asociaciones de un libro creado por el nuevo `POST /libro` viven en
    Postgres, así que ya no hay datos que ese camino MySQL pueda encontrar
    (riesgo aceptado documentado en el plan, sección "Compatibilidad con
    módulos no migrados"). Ajustar los tests que sí quedan (p.ej. "El libro
    tiene las personas cargadas con todos los datos", "Las personas tienen
    el libro asignado") para que usen únicamente las personas cargadas en
    el `POST /libro` inicial, sin depender de los endpoints removidos.
  - Sacar el describe/tests de `GET /libro/:isbn/ventas` si existieran (no
    parecen estar en el archivo actual, verificar igual).
  - Mantener los describe blocks de `GET /libro/:isbn` (incluido el 404),
    `PUT /libro/:isbn` (sin cambio de precio y con cambio de precio),
    `DELETE /libro/:isbn` (incluida la verificación de que ya no aparece
    en `GET` y que sus personas dejan de tener el libro asignado vía
    `GET /persona/:id`) y `GET /libro` (listado).
  - No se pudo correr este test (ni ningún otro test de integración) en
    este entorno: no hay Postgres del proyecto disponible (el de puerto
    5432 de esta máquina es de otro proyecto, no se tocó) ni MySQL de
    `epublit_test` corriendo. Se verificó `npx tsc --noEmit` limpio y se
    revisó el archivo a mano contra `test/persona.test.ts` como referencia
    de forma; falta correr `npm test` contra una base de test real antes de
    darlo por bueno en runtime.

## Ronda 2: simplificar `POST /libro` para que no toque autores/ilustradores

Contexto: `spec.md` y `plan.md` ya se actualizaron para que el alta de un
libro (`POST /libro`) deje de crear/validar autores/ilustradores; sólo
inserta en `librosTable` + `precioLibrosTable`. Las tareas T1-T15 de arriba
ya están implementadas; esta ronda ajusta ese código ya escrito al nuevo
alcance, no vuelve a planificar desde cero. Ver plan.md, sección
"Decisiones y trade-offs", para el detalle de qué se saca y por qué.

- [x] T16. En `src/services/libro.service.ts`: simplificar `create` a la
  transacción de dos pasos que pide el plan. Reemplazar el cuerpo actual de
  `create` (que resuelve `autores`/`ilustradores`, valida existentes/nuevas
  personas e inserta en `personasTable`/`librosPersonasTable`) por:
  `create(data: LibroInsert, userId: number)` → `db.transaction(async (tx) => {
  const [libro] = await tx.insert(librosTable).values({ ...data, user: userId
  }).returning(); await tx.insert(precioLibrosTable).values({ isbn: libro.isbn,
  precio: libro.precio, user: userId, id_libro: libro.id_libro }); return libro;
  })`. Sacar del archivo los tipos `PersonaExistenteRef`/`PersonaNuevaRef`/
  `PersonaRef` y las funciones `esPersonaExistente`/`esPersonaNueva` (ya no
  los usa nadie). No tocar `findOne`, `exists`, `update`, `remove`,
  `getPersonas`, `getPrecios`, `findAllFiltered`, `findAllPaginated`: siguen
  igual, `getPersonas`/`remove` siguen leyendo/limpiando
  `librosPersonasTable` (eso no cambia, sólo cambia que `create` ya no
  escribe ahí).

- [x] T17. En `src/services/libro.service.ts`: limpiar imports que quedan
  sin uso después de T16. Revisar cada uno contra el resto del archivo
  (`findOne`, `exists`, `updateLibro`, `removeLibro`, `getPersonas`,
  `getPrecios` siguen usando varios de ellos, no asumir que todo lo que
  tocaba la lógica de personas queda muerto):
  - `inArray` (de `drizzle-orm`): sólo lo usaba la verificación de
    "existentes" en `create`; si no queda ningún otro `inArray(...)` en el
    archivo, sacarlo del import.
  - `CreateLibroPersona`, `CreateLibroPersonaInDB` (de
    `../validators/libro_persona.validator`): sólo los usaban los tipos
    `PersonaExistenteRef`/`PersonaNuevaRef` de T16; sacarlos del import.
    `tipoPersona`/`TipoPersona` del mismo import **sí** siguen usándose en
    `getPersonas` (no sacarlos).
  - `ValidationError` (de `../models/errors`): sólo la usaba `create` para
    "Alguna persona no existe"/"La persona con dni ... ya se encuentra
    cargada"; si no queda ningún otro `throw new ValidationError(...)` en
    el archivo, sacarla del import (`NotFound` sigue usándose en `findOne`,
    no tocarla).
  - `personasTable` (de `../schemas/personas.schema`): sigue usándose en
    `getPersonas` (join) — no sacarlo, es sólo para verificar que no quedó
    huérfano, no para removerlo.

- [x] T18. En `src/validators/libro.validator.ts`: borrar el schema
  `createLibroConPersonas` (y su tipo exportado `CreateLibroConPersonas`)
  del bloque de validators nuevos — confirmado sin otros consumidores fuera
  de `libro.controller.ts#create` (ver plan, "Decisiones y trade-offs":
  "`createLibroConPersonas` se borra en vez de dejarse 'en baja'"). No
  tocar el resto del archivo: `libroValidator` (select/insert/update/
  filter/pk) queda igual, y el bloque "Validators viejos" (MySQL:
  `createLibro`, `updateLibro`, `libroSchema`, etc., que también usa
  `createlibroPersonaInDB`/`createLibroPersona` en su propio `createLibro`)
  se deja intacto porque sigue siendo consumido indirectamente por
  `libro_persona.controller.ts`/`libro.model.ts` — no confundirlo con el
  `createLibroConPersonas` nuevo que se borra acá. Si el import de
  `createLibroPersona`/`createlibroPersonaInDB` al tope del archivo queda
  sin uso en el bloque nuevo, verificar que el bloque viejo (`createLibro`)
  lo siga necesitando antes de tocarlo (debería, no sacarlo si es así).
  - Confirmado: el import de `createlibroPersonaInDB`/`createLibroPersona` al
    tope del archivo lo sigue necesitando el bloque viejo `createLibro`; no
    se tocó.

- [x] T19. En `src/controllers/libro.controller.ts`: simplificar `create`
  para que ya no desestructure `autores`/`ilustradores` ni importe
  `createLibroConPersonas`. Reemplazar por: parsear el body con
  `libroValidator.insert.parse(req.body)` directo (si el cliente manda
  `autores`/`ilustradores` en el body, Zod los descarta sin error porque
  `insert` no los declara — comportamiento esperado según el plan), llamar
  `libroService.exists(libroBody.isbn, userId)` igual que hoy, y
  `libroService.create(libroBody, userId)` con la firma nueva de T16 (ya
  sin `autores`/`ilustradores`). Sacar el import de `createLibroConPersonas`
  del tope del archivo (queda sólo `libroValidator`). No tocar `update`,
  `remove`, `getOne`, `getPrecios`, `getAll`, `listaLibros`.

- [x] T20. Ajustar `test/libro.test.ts` al nuevo `POST /libro` sin
  autores/ilustradores:
  - En el describe `Crear libro POST /libro`, sacar del body de
    `'Insertar Libro'` las líneas que arman `libro.autores`/
    `libro.ilustradores` (y el `GET /persona/` previo que sólo servía para
    conseguir un `id_persona` para ese body) y las aserciones
    `expect(res.body.data).toHaveProperty("ilustradores"/"autores")`;
    mantener la aserción de 201, `id_libro` presente en `res.body.data` y
    `libro.id_libro = res.body.data.id_libro`.
  - Sacar el test `'El libro tiene las personas cargadas con todos los
    datos'` (dependía de que `POST /libro` creara las asociaciones) y el
    test `'Las personas tienen el libro asignado'` del mismo describe
    (dependía de `libro.personas`, que ya no existe porque no se cargan
    personas en el alta).
  - En el describe `DELETE /libro`, sacar el test `'Las personas no tienen
    más el libro asignado'` (depende de `libro.personas[0]`/`[1]`, que ya
    no se setean); mantener `'Borrado'` y `'No se puede obtener el libro'`.
  - Confirmar que el describe `Obtener libro GET /libro/:isbn` (`'Libro
    obtenido'`, `'Intentar obtener libro que no existe'`) sigue teniendo
    sentido tal cual está: un libro creado sin autores/ilustradores sigue
    debiendo devolver 200 con `autores`/`ilustradores` como arrays vacíos
    en el body (no hace falta un test nuevo específico salvo que al revisar
    se note que ninguna aserción actual cubre el array vacío — en ese caso
    agregar `expect(res.body.autores).toEqual([])` y
    `expect(res.body.ilustradores).toEqual([])` al test `'Libro obtenido'`).
  - Mantener sin cambios los describe `Actualizar libro PUT /libro/:isbn` y
    `Listar todos los libros GET /libro`.
  - No se puede correr `npm test` en este entorno sin Postgres/MySQL de
    test disponibles (mismo motivo documentado en T15); si sigue siendo el
    caso, documentarlo igual que ahí en vez de asumir que pasa.
  - Desvío no contemplado por el enunciado: el test `'Crear libro sin
    personas'` (esperaba 400 al mandar el body de `libro` sin `autores`/
    `ilustradores`) quedó obsoleto por el propio objetivo de esta ronda —
    con `libroValidator.insert` ese mismo body es ahora exactamente el caso
    válido ("crear un libro sin personas" pasa a ser el comportamiento
    esperado, no un error). Tasks no lo menciona explícitamente entre los
    tests a tocar del describe `Crear libro POST /libro`, pero dejarlo tal
    cual rompía el archivo (200/201 en vez del 400 esperado) y además, al
    no removerse antes de `'Insertar Libro'`, hubiera creado el libro dos
    veces con el mismo isbn. Se sacó el test y se fusionó lo que quedaba de
    `'Insertar Libro'` en un único test de alta sin personas. Se documenta
    acá en vez de asumirlo silenciosamente.
  - También se limpiaron del import de `./util` `expectErrorResponse` y
    `expectDataResponse`, que quedaron sin uso en el archivo tras los demás
    recortes de T20.

## Checkpoint final
- [x] `npx tsc --noEmit` sin errores
- [x] Tests relevantes corridos (o motivo documentado de por qué no): no se
  pudo correr `npm test` en este entorno (sin Postgres/MySQL de test
  disponibles, mismo motivo que T15/T20); se revisó `test/libro.test.ts` a
  mano contra el nuevo comportamiento de `POST /libro`.
- [x] Revisado contra CLAUDE.md (DI, DRY, comentarios, responsabilidad
  única): `create` en `libro.service.ts` queda con una única
  responsabilidad (libro + precio inicial) sin lógica de personas mezclada;
  no se agregaron wrappers ni herencia nueva; comentarios agregados
  explican el porqué (que `create` no toca personas por decisión del spec),
  no el qué.
