# Plan: Migrar el módulo `libro_persona` a la nueva arquitectura

## Spec de referencia
specs/003-migrar-libro-persona/spec.md

## Enfoque técnico
`libros_personas` no es una tabla "de un usuario" como `personas` o `libros`:
no tiene columna `user` propia, y su PK ya está ocupada por las tres columnas
de negocio `(id_libro, id_persona, tipo)` (ver `src/schemas/librosPersonas.schema.ts`).
Por eso el `ServiceBuilder` de bradb no puede dar, para esta tabla, la misma
garantía automática de aislamiento por dueño que da la PK compuesta `(id,
user)` en `persona`/`libro`: `findOne`/`update`/`delete` de bradb arman el
WHERE a partir de los valores de PK que se les pasan, pero ninguno de esos
tres valores identifica un usuario. Si sólo se usara `ServiceBuilder` acá,
nada impediría operar sobre una fila cuyo `id_libro` o `id_persona` sea de
otro usuario, siempre que se conozcan sus ids.

Por eso `src/services/libroPersona.service.ts` es un servicio explícito (no
un `ServiceBuilder` desnudo) que reproduce a mano los dos chequeos de dueño
que hace hoy el código MySQL (`Libro.getByIsbn` + `Persona.all_exists`):

1. El libro de la URL (`isbn`) se resuelve con `libroService.findOne(isbn,
   userId)`, que ya tira `NotFound` si no existe, está eliminado, o es de
   otro usuario — se reutiliza tal cual, no se duplica esa lógica (DRY).
2. Cada `id_persona` del body se valida contra `personasTable` filtrando por
   `user = userId` y `deletedAt IS NULL` en una sola consulta con `inArray`,
   igual que el `Persona.all_exists` actual.

El otro problema del dominio es que los tres endpoints son "todo o nada" por
lote: si el body es un array, una fila inválida no debe dejar aplicadas las
demás. Como no hay una única operación bradb que opere sobre varias PKs a la
vez, la estrategia es: **validar todo el lote con consultas bulk antes de
tocar una sola fila**, y sólo entonces escribir. Para `POST`, la escritura en
sí (`INSERT ... VALUES (...), (...), ...`) es una única sentencia multi-fila,
atómica por naturaleza en Postgres (si una fila viola la PK, se revierte
todo el INSERT). Para `PUT`, no hay un único `UPDATE` que ponga un
`porcentaje` distinto por fila sin SQL dinámico complejo, así que se hace un
`db.transaction` con un `UPDATE` por elemento del lote (ver trade-off más
abajo). Para `DELETE` no se valida existencia previa (comportamiento actual
a preservar), así que una única sentencia `DELETE ... WHERE (id_persona,
tipo) IN (...)` alcanza.

## Capas afectadas
- schema (Drizzle, `src/schemas/`): sin cambios. `librosPersonasTable` ya
  existe con la PK `(id_libro, id_persona, tipo)` necesaria; se documenta en
  este plan por qué esa PK alcanza para bradb pero no para el aislamiento
  por dueño (ver "Modelo de datos").
- validator (`src/validators/libro_persona.validator.ts`): se agregan los
  schemas de body de los tres endpoints, sin tocar los exports existentes
  (`tipoPersona`, `TipoPersona`, `libroPersonaSchema`, `libroPersonaKey`,
  `createlibroPersonaInDB`, `createLibroPersona`) porque siguen usados por
  `libro.service.ts`, `persona.service.ts` y `libro.validator.ts`.
  - `libroPersonaBody = libroPersonaSchema.omit({ isbn: true, id_libro: true })`:
    `{id_persona, tipo, porcentaje}`, el cuerpo que manda el cliente para
    `POST`/`PUT` (isbn/id_libro se resuelven server-side, no vienen del
    body).
  - `libroPersonaBodyBatch = libroPersonaBody.or(z.array(libroPersonaBody).min(1))`:
    acepta objeto único o array, para `POST`/`PUT`.
  - `libroPersonaRemoveBody = libroPersonaKey.omit({ isbn: true, id_libro: true })`:
    `{id_persona, tipo}`, el cuerpo de `DELETE`.
  - `libroPersonaRemoveBatch = libroPersonaRemoveBody.or(z.array(libroPersonaRemoveBody).min(1))`.
  - No se agrega un objeto `libroPersonaValidator` agrupador (a diferencia
    de `personaValidator`/`libroValidator`): este archivo ya expone sus
    schemas sueltos y otros módulos ya migrados los importan por nombre
    (`import { tipoPersona } from "./libro_persona.validator"`); agrupar
    ahora rompería esos imports sin necesidad.
- service (`src/services/libroPersona.service.ts`, nuevo): `addToLibro`,
  `updateInLibro`, `removeFromLibro`. Usa `db` (`src/pgDb.ts`),
  `librosPersonasTable`, `personasTable`, y `libroService.findOne` (import
  de `src/services/libro.service.ts`) para resolver y validar el dueño del
  libro. No usa `ServiceBuilder` para las operaciones de escritura por las
  razones de "Modelo de datos"; si en el futuro se agrega una columna
  `user` propia a `libros_personas` (no es parte de este feature), ahí sí
  tendría sentido volver a `ServiceBuilder`.
- controller (`src/controllers/libro_persona.controller.ts`, reescrito):
  reemplaza los imports de `models/persona.model`, `models/libro.model`,
  `models/libro_persona.model` (MySQL) por `libroPersona.service.ts` y los
  validators nuevos. Mantiene la firma pública (`addLibroPersonas`,
  `updateLibroPersonas`, `deleteLibroPersonas`) y el formato de respuesta
  (`makeResponse`, mismos códigos 200/201 y mensajes) para no cambiar el
  comportamiento observable.
- filter (`src/filters/`): no aplica — no hay un `GET /libro/:isbn/personas`
  propio con filtros; `getPersonas` ya existe en `libro.service.ts` y no
  cambia.
- routes (`src/routes/libro.routes.ts`): sin cambios, ya apunta a
  `LibroPersonaController`.
- tests (`test/libro.test.ts` o `test/libro_persona.test.ts`, nuevo/ajustar):
  agregar casos de `POST`/`PUT`/`DELETE /libro/:isbn/personas` sobre
  Postgres (hoy `test/libro.test.ts` sólo limpia `librosPersonasTable` como
  parte de su `beforeAll`/`HARD DELETE`, no la ejerce). Cubrir: alta
  simple y en lote, duplicado (mismo `id_persona` sin importar `tipo`),
  persona inexistente/ajena, isbn ajeno/eliminado, porcentaje fuera de
  rango, edición con `porcentaje: 0` (el caso que corrige el bug), edición
  de asociación inexistente (todo o nada), baja simple y en lote, baja de
  una asociación inexistente (no debe fallar), y que `GET /libro/:isbn` y
  `GET /persona/:id` (si aplica) reflejen los cambios.

## Modelo de datos
Sin cambios de schema. `librosPersonasTable` (`src/schemas/librosPersonas.schema.ts`)
ya tiene la PK compuesta `(id_libro, id_persona, tipo)`, igual que la tabla
MySQL `libros_personas` actual (`LibroPersona.pks`).

Esa PK es suficiente para que `ServiceBuilder` identifique una fila sin
ambigüedad, pero **no** para que bradb garantice aislamiento por dueño como
sí hace en `personas`/`libros`: en esas tablas la PK compuesta incluye
`user`, así que cualquier `findOne`/`update`/`delete` que no incluya el
`user` correcto simplemente no encuentra la fila. Acá no hay una cuarta
columna `user` que agregar a la PK porque el dueño de una fila de
`libros_personas` no es un atributo propio de la fila: se hereda
transitivamente de dos tablas distintas (el libro y la persona referenciados
deben ser, cada uno, del mismo usuario). No existe un valor único de "dueño
de esta fila" que se pueda comparar con una sola igualdad, así que ese
chequeo queda fuera del alcance de lo que la PK compuesta puede resolver por
sí sola y se hace explícito en el service (ver "Enfoque técnico").

## Compatibilidad con módulos no migrados
Este es el primer feature que **escribe** filas reales en la
`libros_personas` de Postgres; hasta ahora sólo se leía (`libro.service.ts`
`getPersonas`/`removeLibro`, `persona.service.ts` `getAllByTipo`/`getLibros`)
sobre una tabla vacía. A partir de este feature, esas lecturas empiezan a
devolver datos reales — conviene verificarlas explícitamente en los tests
nuevos (no sólo los de este módulo), porque es la primera vez que se
ejercitan con datos.

**Riesgo concreto de divergencia: `liquidacion` sigue en MySQL y depende de
`libro_persona`.** `src/controllers/liquidacion.controller.ts` (`create`)
llama a `LibroPersona.exists(...)` (`src/models/libro_persona.model.ts`,
MySQL) para validar que la persona indicada trabaja en el libro antes de
generar una liquidación. Después de este feature, las asociaciones nuevas
(altas/bajas/ediciones hechas vía `POST`/`PUT`/`DELETE
/libro/:isbn/personas`) se escriben únicamente en Postgres; la tabla MySQL
`libros_personas` deja de recibir escrituras y queda congelada con los datos
que tenía al momento de este deploy. Consecuencia concreta:
- Una persona asociada a un libro *después* de este deploy no va a existir
  para `LibroPersona.exists` en MySQL, así que `POST /liquidacion` la va a
  rechazar con `ValidationError` ("no trabaja en el libro") aunque sí esté
  asociada según `GET /libro/:isbn`.
- Una asociación editada o eliminada después de este deploy va a seguir
  existiendo con su porcentaje viejo (o va a seguir "existiendo") del lado
  de `liquidacion`, que no se entera del cambio.

Esto no es distinto en naturaleza del riesgo ya aceptado al migrar `libro`
y `persona` (`liquidacion.controller.ts` ya lee `Libro`/`Persona` de MySQL
también congelados desde esas migraciones); se documenta acá porque es la
primera vez que el propio feature es el que empieza a *generar* la
divergencia en `libros_personas`, no sólo a heredarla. No se soluciona en
este feature (dual-write a MySQL queda fuera de alcance: agregaría
complejidad y acoplamiento temporal que el orden de migración acordado
justamente busca evitar) — se resuelve cuando `liquidacion` migre.

`cliente`, `transaccion`, `venta` no leen `libros_personas` directa ni
indirectamente (no la importan); no hay impacto adicional que documentar
ahí.

## Decisiones y trade-offs

**Servicio explícito en vez de `ServiceBuilder` puro para el CRUD de la
relación.** Se gana: el aislamiento por dueño real (libro Y persona del
usuario), que `ServiceBuilder` no puede dar acá (ver "Modelo de datos"). Se
pierde: un poco del ahorro de código que da `ServiceBuilder` en `persona`/
`libro` (acá se escriben los `WHERE`/`INSERT`/`UPDATE`/`DELETE` a mano). Es
la alternativa correcta porque la garantía que necesitamos no es expresable
como una PK.

**`POST`: un único `INSERT` multi-fila tras las validaciones bulk, sin
`db.transaction` explícito para el INSERT en sí, pero con las dos
validaciones (duplicado + existencia de personas) sí envueltas junto al
INSERT en una transacción.** Se gana: cerrar la ventana de carrera entre "se
validó que no hay duplicado" y "se insertó" — sin la transacción, dos
requests idénticos concurrentes podrían pasar ambos la validación y luego
chocar contra la restricción de PK de Postgres, devolviendo un error crudo
de Postgres en vez del `Duplicated` de dominio. Se pierde: una transacción
extra de round-trip por request (costo menor, aceptable para el volumen de
este endpoint). Alternativa descartada: no usar transacción y dejar que la
violación de PK se traduzca a `Duplicated` en el manejo de errores —
rechazada porque agregaría un nuevo tipo de mapeo de error de Postgres que
no existe hoy en el proyecto para este caso, y porque el `db.transaction` ya
es el patrón usado en `libro.service.ts`'s `create`.

**`PUT`: un `UPDATE` por elemento del lote dentro de un único
`db.transaction`, en vez de un solo `UPDATE ... FROM (VALUES ...)`
multi-fila.** Se gana: legibilidad y una sola responsabilidad por línea de
código (armar el `SET porcentaje = x WHERE id_libro/id_persona/tipo = y`
para un elemento es trivial; construir el SQL dinámico de un `UPDATE FROM
VALUES` con tipos por columna no lo es). Se pierde: N round-trips a la base
en vez de 1 para lotes grandes. Es aceptable porque el tamaño esperado del
lote es chico (los autores/ilustradores de un libro, no miles de filas); si
el volumen creciera, ahí sí valdría la pena el `UPDATE` multi-fila.

**Corrección del bug de porcentaje `0`.** El código MySQL actual
(`src/models/libro_persona.model.ts`, `LibroPersona.update`) sólo aplica el
`UPDATE` `if (persona.porcentaje)`, un chequeo de verdad de JS que trata `0`
igual que `undefined`/`null`, así que un `PUT` con `porcentaje: 0` no
modifica nada aunque responda 201. `libroPersonaSchema.porcentaje` (usado
por el nuevo `libroPersonaBody`) es un campo **requerido**, no opcional, así
que `updateInLibro` no necesita (ni debe) chequear si vino o no: siempre
arma el `SET porcentaje: item.porcentaje` con el valor validado por zod. No
reintroducir ningún chequeo de verdad (`if (item.porcentaje)`) sobre ese
valor es la forma concreta de no repetir el bug; el `min(0)` de
`libroPersonaSchema` ya garantiza que `0` es un valor válido y distinguible
de "no enviado" (que ni siquiera es una opción con este schema).

**Aislamiento por dueño: `POST` valida las dos puntas (libro y cada
persona), `PUT`/`DELETE` sólo validan el libro.** Igual que el código MySQL
actual: `Persona.all_exists` sólo se llama en el alta
(`addLibroPersonas`); `updateLibroPersonas`/`deleteLibroPersonas` no
revalidan dueño de la persona. Esto es seguro porque una fila de
`libros_personas` sólo puede existir si, al momento de crearla, tanto el
libro como la persona eran del mismo usuario (invariante que garantiza el
`POST` de este mismo servicio); filtrar por `id_libro` del libro del
usuario en `PUT`/`DELETE` ya acota la operación a filas que nacieron bajo
esa garantía. Se documenta explícitamente porque, a diferencia de
`persona`/`libro`, acá no hay una PK que lo haga evidente con sólo mirar la
firma del método.

**Body objeto-o-array en el validator, no en el controller.** Se gana:
mover la normalización de "objeto único vs. array" al lugar donde ya vive
toda la demás validación (zod), en vez de un `Array.isArray(req.body) ?
req.body : [req.body]` manual como hace hoy el controller MySQL antes de
parsear. El controller nuevo hace `const body =
libroPersonaBodyBatch.parse(req.body); const items = Array.isArray(body) ?
body : [body];` — el `Array.isArray` que queda es sólo para tipar el array
ya validado, no para decidir qué validar.

## Riesgos
- Divergencia de datos con `liquidacion` (MySQL) descripta en
  "Compatibilidad con módulos no migrados": aceptada por el orden de
  migración acordado, no se mitiga en este feature.
- Lotes grandes en `PUT` (N `UPDATE`s dentro de una transacción) podrían
  degradar performance si en el futuro se permiten lotes de tamaño no
  acotado; hoy el dominio (autores/ilustradores de un libro) lo mantiene
  chico de forma natural, no se agrega un límite explícito de tamaño de
  lote porque el spec no lo pide.

## Fuera de alcance / deuda aceptada
- No se crean personas nuevas "al vuelo" al asociarlas a un libro (spec,
  "No incluye"); `createLibroPersona`/`createlibroPersonaInDB` quedan sin
  conectar a ningún endpoint, igual que hoy.
- No se borra `src/models/libro_persona.model.ts` (MySQL) ni sus tipos en
  `src/validators/libro_persona.validator.ts` asociados al patrón viejo:
  `liquidacion.controller.ts` todavía los usa (`LibroPersona.exists`). Se
  da de baja recién cuando `liquidacion` migre.
- No se agrega dual-write hacia MySQL para mantener sincronizada
  `liquidacion` mientras no migre; ver "Compatibilidad con módulos no
  migrados".
- No se agrega un `GET /libro/:isbn/personas` ni un `GET /persona/:id/libros`
  nuevos; el spec confirma que quedan fuera (`getPersonas`/`getLibros` ya
  existen y se siguen usando desde `GET /libro/:isbn`/`GET /persona/:id`).
