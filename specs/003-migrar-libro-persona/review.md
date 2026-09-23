# Review: 003-migrar-libro-persona

## Verificación técnica

- `npx tsc --noEmit`: sin errores, compila limpio.
- `npx vitest run test/libro_persona.test.ts`: **no se pudo correr en este
  entorno** (falla `testDBConnection` en `src/pgDb.ts` con
  `TypeError: Cannot read properties of undefined (reading 'prototype')` en
  `node_modules/buffer-equal-constant-time` / `jwa`, y luego `process.exit(1)`
  al no poder autenticar contra Postgres). No hay Postgres/MySQL del proyecto
  disponibles en este entorno, consistente con lo ya documentado en T7 de
  `tasks.md` para los features anteriores (`user`, `libro`). No pude verificar
  en runtime ningún caso de `test/libro_persona.test.ts`; la revisión de esos
  casos es sólo por lectura de código.

## Contra el spec

Repasé cada criterio de aceptación de `spec.md` contra
`src/services/libroPersona.service.ts` y `src/controllers/libro_persona.controller.ts`:

- `POST` objeto/array, 201, libro + asociaciones creadas: cumplido
  (`addLibroPersonas` + `addToLibro`, `.returning()`).
- `POST` duplicado (misma persona, sin importar tipo) → error de duplicado,
  nada se crea: cumplido contra filas **ya existentes** en la tabla (ver
  hallazgo no bloqueante más abajo sobre duplicados *dentro* del mismo lote).
- `POST` persona inexistente/ajena → 404, nada se crea: cumplido
  (`personasPropias.length < ids.length` dentro de la misma transacción que
  el insert).
- `POST` isbn ajeno/eliminado/inexistente → 404: cumplido vía
  `libroService.findOne`, reutilizado tal cual (DRY, como dice el plan).
- `POST` porcentaje fuera de 0-100 → 400: cumplido, `libroPersonaSchema.porcentaje`
  es `z.number().min(0).max(100)`, validado por zod antes de llegar al
  service (`ZodError` → 400 en `handleErrors`).
- `PUT` objeto/array, 201, asociaciones actualizadas: cumplido.
- `PUT` combinación no asociada → 404, nada se modifica: cumplido, valida
  todo el lote contra `librosPersonasTable` antes de aplicar cualquier
  `UPDATE`.
- `PUT` porcentaje `0` aplica el cambio (corrección del bug MySQL): cumplido.
  `libroPersonaBody` usa `libroPersonaSchema.omit(...)`, así que
  `porcentaje` queda **requerido** (no opcional), y `updateInLibro` arma
  `.set({ porcentaje: item.porcentaje })` sin ningún chequeo de verdad tipo
  `if (item.porcentaje)`. Comentario en el código lo deja explícito. El test
  `PUT.../Edición con porcentaje 0` ejercita exactamente este caso (no
  verificable en runtime acá, pero el código es correcto por lectura).
- `DELETE` objeto/array, 200, asociaciones eliminadas: cumplido.
- `DELETE` de asociación inexistente no rompe la request: cumplido, no valida
  existencia previa, sentencia `DELETE ... WHERE ... IN (...)` directa sin
  transacción, igual que el `LibroPersona.remove`/`_bulk_remove` de MySQL.
- Aislamiento por dueño (isbn ajeno/eliminado en los tres endpoints, persona
  ajena en `POST`): cumplido y documentado explícitamente en el plan por qué
  `PUT`/`DELETE` no revalidan dueño de cada persona (invariante heredada del
  `POST` que las creó). El razonamiento es válido: una fila de
  `libros_personas` sólo pudo nacer si, al momento del alta, tanto el libro
  como la persona eran del mismo usuario, y `PUT`/`DELETE` ya filtran por
  `id_libro` del libro validado como propio.
- Objeto único vs. array en los tres endpoints: cumplido, resuelto en el
  validator (`.or(z.array(...).min(1))`) y no en el controller, tal como
  decía el plan.
- Casos borde de "todo o nada" por lote: cumplidos vía validación bulk previa
  a la escritura en los tres services.
- Caso borde de libro eliminado → 404 en los tres endpoints: cumplido, se
  apoya en que `libroService.findOne` ya filtra `deletedAt IS NULL`.

No encontré comportamiento del spec que falte en el código.

## Hallazgo confirmado: duplicados dentro del mismo lote de `POST`

Confirmé el punto que señalaste. En `src/services/libroPersona.service.ts`,
`addToLibro`:

```ts
const duplicadas = await tx
    .select({ id_persona: librosPersonasTable.id_persona })
    .from(librosPersonasTable)
    .where(and(eq(librosPersonasTable.id_libro, libro.id_libro), inArray(librosPersonasTable.id_persona, ids)));

if (duplicadas.length > 0) {
    throw new Duplicated("Alguna persona ya trabaja en ese libro");
}
...
return tx
    .insert(librosPersonasTable)
    .values(items.map((item) => ({ ...item, isbn: libro.isbn, id_libro: libro.id_libro })))
    .returning();
```

Esto sólo valida duplicados contra filas **ya existentes** en
`librosPersonasTable` (`ids` son los `id_persona` únicos del lote, comparados
contra la tabla). No valida duplicados **dentro del propio `items`**: si el
body trae dos veces el mismo `{id_persona, tipo}` (p. ej.
`[{id_persona: 1, tipo: "autor", porcentaje: 50}, {id_persona: 1, tipo: "autor", porcentaje: 80}]`),
ambas filas pasan la validación de "duplicadas contra la tabla" (porque
ninguna existe todavía) y llegan al `INSERT` multi-fila, que sí choca contra
la PK compuesta `(id_libro, id_persona, tipo)` del propio schema
(`src/schemas/librosPersonas.schema.ts:24`). Ese error de Postgres (código
`23505`, violación de unicidad) no está mapeado en `handleErrors`
(`src/models/errors.ts`): no es `ZodError`, no es `ApiError`, no es
`ServiceError` de bradb, no es `AfipError`, así que cae en el branch genérico
final y responde **500 "Internal server error"** en vez del 404 `Duplicated`
que pide el spec para el caso general de duplicado.

**Contexto que atenúa el hallazgo:**
- Verifiqué el controller/modelo MySQL anterior
  (`src/controllers/libro_persona.controller.ts` en `HEAD~20` /
  `src/models/libro_persona.model.ts`): tiene exactamente la misma
  limitación. `LibroPersona.any_exists` sólo consulta contra la tabla, no
  contra el propio batch, y `LibroPersona.insert` → `_bulk_insert` también
  quedaría expuesto a un error crudo de MySQL ante un batch con el mismo
  `(id_libro, id_persona, tipo)` repetido. No es una regresión introducida
  por esta migración; es paridad de comportamiento con el código que
  reemplaza.
- El spec no menciona explícitamente el caso "duplicado dentro del mismo
  lote" (sólo habla de "si alguna persona indicada ya está asociada a ese
  libro", que en el contexto de la sección junto con "Casos borde" se lee
  como asociaciones preexistentes). El plan tampoco lo lista como caso de
  test a cubrir en T7-T9, y de hecho no hay ningún test en
  `test/libro_persona.test.ts` que ejercite un batch con `id_persona`+`tipo`
  repetido dentro del mismo array.

**Por qué igual vale la pena señalarlo:** el propio plan
(`plan.md`, "Decisiones y trade-offs", sección de `POST`) justifica envolver
la validación de duplicados y el `INSERT` en una única transacción
precisamente para "cerrar la ventana de carrera... sin la transacción, dos
requests idénticos concurrentes podrían pasar ambos la validación y luego
chocar contra la restricción de PK de Postgres, devolviendo un error crudo de
Postgres en vez del `Duplicated` de dominio" — y rechaza explícitamente la
alternativa de "traducir la violación de PK a `Duplicated`" por no querer
agregar ese tipo de mapeo. Pero el caso de duplicado *dentro del mismo
batch* dispara ese mismo error crudo de Postgres de forma **determinística**
con un solo request (no hace falta concurrencia ni una carrera), así que la
transacción no lo previene: el riesgo que el plan dice mitigar sigue abierto
para este caso, sólo que por un camino distinto (self-duplicate en vez de
carrera entre requests).

**Clasificación: hallazgo no bloqueante (sugerencia), no bloqueante contra
el spec.** No contradice ningún criterio de aceptación explícito del spec
(que habla de asociaciones ya existentes, no de auto-duplicados dentro del
lote) y reproduce el comportamiento actual de MySQL, así que no es una
regresión. Pero sí es una inconsistencia interna: el propio `POST` responde
distinto (404 `Duplicated` vs. 500 crudo) según si el duplicado viene de la
tabla o del mismo body, cuando conceptualmente es el mismo tipo de error de
dominio. Sugerencia concreta: agregar una validación de duplicados dentro
del propio `items` (por `id_persona`, ignorando `tipo`, igual que la
validación contra la tabla) antes de la consulta a `librosPersonasTable`, o
reusar la misma función auxiliar `uniqueIds` para detectar si
`ids.length !== items.length` y tirar el mismo `Duplicated` en ese caso.

## Contra el plan

- Capas tocadas coinciden exactamente con lo que dice `plan.md`: validator
  (agregados, sin tocar exports existentes — confirmado, ver sección
  siguiente), service nuevo, controller reescrito, rutas sin cambios
  (confirmado por lectura de `src/routes/libro.routes.ts`, las tres rutas ya
  apuntaban a `LibroPersonaController`), tests nuevos.
- El desvío documentado en T1 de `tasks.md` (`libroPersonaKey.omit({id_libro: true})`
  en vez de `.omit({isbn: true, id_libro: true})` porque `isbn` ya estaba
  omitido en `libroPersonaKey`) es correcto: confirmé en
  `src/validators/libro_persona.validator.ts:23-26` que `libroPersonaKey` ya
  omite `porcentaje` e `isbn`, así que volver a omitir `isbn` en
  `libroPersonaRemoveBody` sería un error de zod (`omit` de una key
  inexistente). El desvío está bien anotado y es la única forma de que
  compile con el resultado `{id_persona, tipo}` que pide el plan. No es un
  desvío silencioso.
- La estrategia "validar todo el lote antes de escribir" para `POST`/`PUT`,
  `INSERT` multi-fila para `POST`, `N UPDATE`s en una transacción para
  `PUT`, `DELETE` único sin transacción, se implementó tal cual la describe
  el plan.
- `updateInLibro` no revalida dueño de cada persona, `removeFromLibro`
  tampoco: consistente con lo que documenta el plan en "Decisiones y
  trade-offs".
- No se agrupan los schemas nuevos en un objeto validador (a diferencia de
  `personaValidator`/`libroValidator`): confirmado, se exportan sueltos como
  pedía el plan, para no romper los imports existentes de
  `tipoPersona`/`libroPersonaSchema`/etc. desde `libro.service.ts`,
  `libro.validator.ts`, `liquidacion.validator.ts`, `persona.controller.ts`,
  `libro.model.ts` (confirmé por grep que todos esos imports siguen
  apuntando a los mismos nombres y siguen existiendo en el archivo).
- No se tocó `src/models/libro_persona.model.ts` (MySQL) ni
  `liquidacion.controller.ts`: correcto, fuera de alcance según el plan.

No encontré desvíos del plan sin justificar.

## Contra CLAUDE.md

- **Inyección de dependencias > herencia:** no aplica jerarquías de clases
  acá; `libroPersonaService` es un objeto de funciones que recibe sus
  dependencias (`db`, `libroService.findOne`) por import directo, consistente
  con el patrón ya usado en `libro.service.ts`/`persona.service.ts`. Sin
  hallazgos.
- **DRY:** el chequeo de dueño del libro se reutiliza vía
  `libroService.findOne` en los tres métodos, sin duplicar la lógica de
  `Libro.getByIsbn`. La construcción del `WHERE (id_persona, tipo) IN` se
  repite entre `updateInLibro` (líneas 60-63) y `removeFromLibro` (líneas
  103-106) con la misma expresión `or(...items.map(...))`, pero son sólo dos
  usos, cada uno con una semántica ligeramente distinta (uno es la condición
  del `SELECT` de validación + luego el `WHERE` del `UPDATE` por item; el
  otro es el `WHERE` de un único `DELETE`). Extraerlo a un helper sería una
  mejora menor de legibilidad, no una duplicación que viole DRY de forma
  clara — lo dejo como sugerencia opcional, no como hallazgo.
- **Comentarios explican el por qué, no el qué:** repasé todos los
  comentarios en `libroPersona.service.ts` y `libro_persona.validator.ts`.
  Todos explican decisiones (por qué no `ServiceBuilder`, por qué no se
  revalida dueño de persona en `PUT`/`DELETE`, por qué no hay chequeo de
  verdad sobre `porcentaje`, por qué no hay transacción en `DELETE`), no
  repiten el código. Ninguno es ruido.
- **Una función, una responsabilidad:** `addToLibro`/`updateInLibro`/`removeFromLibro`
  cada una hace: resolver dueño + validar lote + escribir, que son tres
  pasos cohesivos de una misma operación de dominio, no responsabilidades
  independientes mezcladas sin relación. No hay wrappers vacíos que sólo
  reenvíen una llamada (`libroPersonaService` es un objeto agrupador de las
  tres funciones reales, no una indirección extra). El controller
  (`addLibroPersonas`/etc.) es un adaptador HTTP delgado (parsear body →
  llamar al service → formatear respuesta), consistente con el patrón ya
  usado en `libro.controller.ts`/`persona.controller.ts`.

## Resumen

- **Bloqueantes:** ninguno. Todos los criterios de aceptación del spec están
  cumplidos por lectura de código, el plan se siguió sin desvíos sin
  justificar, y `npx tsc --noEmit` compila limpio.
- **No bloqueante / sugerencia:** el caso de duplicado *dentro del mismo
  lote* de `POST /libro/:isbn/personas` (mismo `id_persona`+`tipo` repetido
  en el array del body) no se valida contra sí mismo, sólo contra la tabla;
  termina disparando un error crudo de Postgres (PK `23505`) que
  `handleErrors` no mapea y cae en 500 genérico en vez del 404 `Duplicated`
  de dominio. Confirmado por lectura de
  `src/services/libroPersona.service.ts:22-29` y del schema
  `src/schemas/librosPersonas.schema.ts:24`. Es paridad con el comportamiento
  MySQL anterior (mismo problema existe en el código que reemplaza), no está
  cubierto por ningún test existente, y el spec no lo menciona
  explícitamente como criterio de aceptación — por eso no lo bloqueo — pero
  sí es una inconsistencia respecto al propio objetivo que el plan se puso
  para `POST` (evitar errores crudos de Postgres ante duplicados). Sugerencia
  concreta: comparar `ids.length` contra `items.length` (o similar) antes de
  la consulta a la tabla y tirar el mismo `Duplicated` si hay repetidos en
  el propio lote.
- **No verificable en este entorno:** ningún test de
  `test/libro_persona.test.ts` pudo correrse (sin Postgres del proyecto
  disponible, `testDBConnection` falla antes de cualquier `it`). La revisión
  de esos casos es sólo por lectura de código; el archivo compila limpio con
  `tsc` y sigue el patrón de `test/libro.test.ts`/`test/persona.test.ts`.
