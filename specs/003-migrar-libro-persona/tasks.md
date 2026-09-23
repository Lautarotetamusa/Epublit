# Tasks: Migrar el módulo `libro_persona` a la nueva arquitectura

Plan de referencia: specs/003-migrar-libro-persona/plan.md

Cada tarea es chica, verificable de forma independiente, y en orden de dependencia.
Marcar `[x]` al completarla y agregar una línea con lo que efectivamente se hizo
si difiere del enunciado.

- [x] T1. Agregar a `src/validators/libro_persona.validator.ts` los schemas
  de body de los tres endpoints, sin tocar los exports existentes
  (`tipoPersona`, `TipoPersona`, `libroPersonaSchema`, `libroPersonaKey`,
  `createlibroPersonaInDB`, `createLibroPersona`):
  - `libroPersonaBody = libroPersonaSchema.omit({ isbn: true, id_libro: true })`
    → `{id_persona, tipo, porcentaje}`, con `porcentaje` **requerido** (no
    `.optional()`), tal cual ya lo define `libroPersonaSchema` — es la forma
    concreta de no reintroducir el bug de porcentaje `0`.
  - `libroPersonaBodyBatch = libroPersonaBody.or(z.array(libroPersonaBody).min(1))`.
  - `libroPersonaRemoveBody = libroPersonaKey.omit({ isbn: true, id_libro: true })`
    → `{id_persona, tipo}`.
  - `libroPersonaRemoveBatch = libroPersonaRemoveBody.or(z.array(libroPersonaRemoveBody).min(1))`.
  - No agrupar estos schemas en un objeto validador nuevo (a diferencia de
    `personaValidator`/`libroValidator`): exportarlos sueltos, igual que el
    resto del archivo, porque otros módulos ya importan por nombre desde acá.
  - Desvío: `libroPersonaKey` ya omite `isbn` en su propia definición
    (`libroPersonaSchema.omit({porcentaje: true, isbn: true})`), así que
    `libroPersonaRemoveBody = libroPersonaKey.omit({isbn: true, id_libro: true})`
    tal cual lo enuncia la tarea no compila (zod tira `TS2322` al omitir una
    key ya ausente). Se implementó como
    `libroPersonaKey.omit({id_libro: true})`, que da el mismo resultado
    `{id_persona, tipo}`.

- [x] T2. Crear `src/services/libroPersona.service.ts` con la función
  `addToLibro(isbn: string, userId: number, items: LibroPersonaBody[])`:
  - Resuelve el libro con `libroService.findOne(isbn, userId)` (tira
    `NotFound` si no existe/eliminado/ajeno; reusar tal cual, no duplicar).
  - Dentro de un único `db.transaction`:
    1. Valida duplicados: si alguna fila de `librosPersonasTable` ya existe
       con el mismo `id_libro` y alguno de los `id_persona` del lote (sin
       filtrar por `tipo`, ver spec "la validación de 'ya está asociada' al
       crear ignora el tipo"), tira `Duplicated("Alguna persona ya trabaja
       en ese libro")`.
    2. Valida existencia/dueño de cada persona: consulta `personasTable`
       con `inArray(personasTable.id, ids)` filtrando
       `personasTable.user = userId` y `isNull(personasTable.deletedAt)`; si
       la cantidad de filas encontradas es menor a la cantidad de
       `id_persona` únicos del lote, tira `NotFound("Alguna persona no
       existe")`.
    3. Hace el `INSERT` multi-fila (`tx.insert(librosPersonasTable).values([...])`)
       con `id_libro` e `isbn` tomados del libro resuelto en el paso previo
       (no del body) para cada item del lote, y devuelve las filas
       insertadas (`.returning()`).
  - Devuelve `{ libro, personas: <filas insertadas> }`.
  - No usar `ServiceBuilder` para esta escritura (ver plan, "Modelo de
    datos" y "Decisiones y trade-offs": `libros_personas` no tiene columna
    `user` propia).

- [x] T3. Agregar a `src/services/libroPersona.service.ts` la función
  `updateInLibro(isbn: string, userId: number, items: LibroPersonaBody[])`:
  - Resuelve el libro con `libroService.findOne(isbn, userId)` (sólo valida
    dueño del libro, no de cada persona — ver plan, "Decisiones y
    trade-offs": la fila sólo pudo existir si nació bajo el `POST` que ya
    validó ambas puntas).
  - Dentro de un único `db.transaction`:
    1. Valida que cada combinación `(id_persona, tipo)` del lote exista en
       `librosPersonasTable` para ese `id_libro`; si falta alguna, tira
       `NotFound("Alguna persona no trabaja en este libro")` sin aplicar
       nada.
    2. Ejecuta un `UPDATE` por elemento del lote
       (`tx.update(librosPersonasTable).set({ porcentaje: item.porcentaje })
       .where(...).returning()`), armando siempre el `SET porcentaje:
       item.porcentaje` sin ningún chequeo de verdad tipo `if
       (item.porcentaje)` — el schema de T1 ya garantiza que viene definido,
       incluyendo `0`.
  - Devuelve `{ libro, personas: <filas actualizadas> }`.

- [x] T4. Agregar a `src/services/libroPersona.service.ts` la función
  `removeFromLibro(isbn: string, userId: number, items: LibroPersonaRemoveBody[])`
  y el export final del módulo (`libroPersonaService`):
  - Resuelve el libro con `libroService.findOne(isbn, userId)`.
  - Ejecuta una única sentencia `DELETE` sobre `librosPersonasTable`
    filtrando por `id_libro` del libro resuelto y `(id_persona, tipo) IN
    (...)` del lote (sin `db.transaction`, sin validar existencia previa —
    comportamiento actual a preservar: borrar una asociación inexistente no
    debe fallar).
  - Devuelve `{ libro, personas: items }` (no hace falta `.returning()`
    porque no se valida qué se borró efectivamente, igual que el
    comportamiento MySQL actual).
  - Exportar `libroPersonaService = { addToLibro, updateInLibro,
    removeFromLibro }`.

- [x] T5. Reescribir `src/controllers/libro_persona.controller.ts`
  reemplazando los imports de `models/persona.model`, `models/libro.model`,
  `models/libro_persona.model` (MySQL) por `libroPersonaService`
  (`../services/libroPersona.service`) y los validators nuevos de T1
  (`libroPersonaBodyBatch`, `libroPersonaRemoveBatch`):
  - `addLibroPersonas`: `const body = libroPersonaBodyBatch.parse(req.body);
    const items = Array.isArray(body) ? body : [body];` (el `Array.isArray`
    es sólo para tipar, no para decidir qué validar — la normalización
    objeto-o-array ya la hizo el `.or(z.array(...))` del schema), llama a
    `libroPersonaService.addToLibro(req.params.isbn, res.locals.user.id,
    items)` y responde con `makeResponse(res, libro, personas, "post")`
    (mantener `makeResponse` tal cual está, sin cambios de formato/códigos).
  - `updateLibroPersonas`: mismo patrón con `libroPersonaBodyBatch` y
    `libroPersonaService.updateInLibro`, respuesta `"put"`.
  - `deleteLibroPersonas`: mismo patrón con `libroPersonaRemoveBatch` y
    `libroPersonaService.removeFromLibro`, respuesta `"delete"`.
  - Mantener la firma pública exportada (`addLibroPersonas`,
    `updateLibroPersonas`, `deleteLibroPersonas`) igual que hoy, para no
    tocar `src/routes/libro.routes.ts`.

- [x] T6. Verificar `src/routes/libro.routes.ts`: confirmar que las tres
  rutas (`POST`/`PUT`/`DELETE /:isbn/personas`) siguen apuntando a
  `LibroPersonaController` sin cambios (el plan dice explícitamente "sin
  cambios"); si algo no compila tras T5, es la única tarea donde corregir
  ese archivo.
  - Verificado: las tres rutas ya apuntaban a `LibroPersonaController` y
    `npx tsc --noEmit` quedó sin errores tras T5, no hizo falta tocar el
    archivo.

- [x] T7. Crear `test/libro_persona.test.ts` (seguir el patrón de
  `test/libro.test.ts`/`test/persona.test.ts`: `dotenv`, `DB_NAME =
  "epublit_test"`, login, un `it('HARD DELETE', ...)` inicial que limpia
  `librosPersonasTable`/`personasTable`/`librosTable` para el isbn/dni de
  prueba, `afterAll` que cierra `conn`/`server`) con los casos de `POST
  /libro/:isbn/personas`:
  - Setup: crear un libro propio y una o más personas propias (vía los
    endpoints `POST /libro` y `POST /persona` ya migrados) antes de estos
    casos.
  - Alta simple (un objeto, no array): 201, devuelve libro + persona
    asociada.
  - Alta en lote (array de 2+ personas válidas): 201, devuelve las dos
    asociaciones.
  - Duplicado: asociar de nuevo una persona ya asociada a ese libro (mismo
    `id_persona`, `tipo` distinto) → error de duplicado, y verificar que no
    se creó ninguna fila nueva del lote si el request incluía otras
    personas válidas junto con la duplicada.
  - Persona inexistente o de otro usuario en el body → 404, no se crea
    nada del lote.
  - Isbn de la URL ajeno o eliminado → 404, no se crea nada.
  - Porcentaje fuera de rango (`<0` o `>100`) → 400, no se crea nada.
  - No verificable en runtime en este entorno (sin Postgres/MySQL
    disponibles, mismo criterio que `user`/`libro`): `npx vitest run
    test/libro_persona.test.ts` falla en `testDBConnection`
    (`src/pgDb.ts`) antes de correr ningún `it`, por falla de autenticación
    contra Postgres. El archivo sí compila (`npx tsc --noEmit` limpio) y
    sigue el patrón de `test/libro.test.ts`/`test/persona.test.ts`.

- [x] T8. Agregar a `test/libro_persona.test.ts` los casos de `PUT
  /libro/:isbn/personas` (reusando el libro/personas ya asociadas del setup
  de T7):
  - Edición simple y en lote de porcentaje → 201, devuelve las asociaciones
    actualizadas con el nuevo porcentaje.
  - Edición con `porcentaje: 0` → 201 y el porcentaje efectivamente queda en
    `0` (leer la fila después, ya sea vía `GET /libro/:isbn` o consultando
    `librosPersonasTable` directo) — éste es el caso que corrige el bug
    documentado en el plan/spec.
  - Edición de una combinación `(id_persona, tipo)` que no está asociada al
    libro → 404, y si el lote tenía otras combinaciones válidas junto con
    la inválida, verificar que ninguna se aplicó (todo o nada).

- [x] T9. Agregar a `test/libro_persona.test.ts` los casos de `DELETE
  /libro/:isbn/personas` y de aislamiento por dueño:
  - Baja simple y en lote → 200, y después `GET /libro/:isbn` ya no lista
    esas personas entre autores/ilustradores.
  - Baja de una asociación inexistente → no debe fallar (mismo status de
    éxito que una baja válida).
  - Verificar que `GET /persona/:id` (campo `libros`, vía
    `personaService.getLibros`) refleja las altas/bajas hechas en T7-T9
    para esa persona.
  - Caso borde de "libro eliminado": eliminar el libro (`DELETE
    /libro/:isbn`) y verificar que un `POST`/`PUT`/`DELETE
    /libro/:isbn/personas` posterior sobre ese isbn responde 404 en los
    tres.

## Checkpoint final
- [x] `npx tsc --noEmit` sin errores
- [x] Tests relevantes corridos (o motivo documentado de por qué no): no corren en este entorno (sin Postgres/MySQL disponibles), ver nota en T7.
- [x] Revisado contra CLAUDE.md (DI, DRY, comentarios, responsabilidad única)
