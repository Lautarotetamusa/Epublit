# Arquitectura

Contexto para el `implementer`. Ver `CLAUDE.md` para las reglas de estilo
(DI, DRY, comentarios, responsabilidad única) — son obligatorias acá abajo.

## Estructura general

```
src/
  modules/<nombre>/     un módulo por entidad de negocio (persona, libro, cliente, ...)
  lib/                  infra compartida sin reglas de negocio (auth, afip, http, comprobantes)
  db/                   client de Drizzle (db, Tx) y el schema barrel
  container.ts          composition root: arma todos los módulos e inyecta sus dependencias
  app.ts                registra cada module.router bajo su prefijo
  index.ts              entrypoint: crea el container, crea la app, escucha el puerto
```

Nada fuera de `src/modules/<x>/index.ts` importa el interior de otro
módulo, salvo `*.schema.ts` (ver más abajo). Esa regla es la que evita
ciclos de imports.

## Capas dentro de un módulo

Un módulo (`src/modules/<nombre>/`) tiene hasta 7 archivos, cada uno con
una sola responsabilidad:

| Archivo | Responsabilidad |
|---|---|
| `<nombre>.schema.ts` | Tabla de Drizzle (`pgTable`). Única fuente de verdad de la DB. |
| `<nombre>.validator.ts` | Schemas de zod (derivados del schema con `drizzle-zod`) + los tipos que usa el resto del módulo. |
| `<nombre>.filter.ts` | `FilterMap` de bradb: mapea claves de filtro a condiciones SQL (`eq`, etc.). |
| `<nombre>.repository.ts` | **Sólo queries.** CRUD vía `ServiceBuilder` (bradb) + queries custom. Sin reglas de negocio. Los métodos que pueden participar de una transacción externa reciben `tx?: Tx` opcional y usan `(tx ?? db)`. |
| `<nombre>.service.ts` | **Reglas de negocio.** Valida, orquesta, y es quien abre `db.transaction(...)` cuando dos o más queries tienen que ser atómicas — nunca el repository. Puede depender de repositories de otros módulos (lectura/ownership) o de services de otros módulos (cuando necesita una regla de negocio ajena, no sólo un dato). |
| `<nombre>.controller.ts` | Adapter HTTP puro: parsea con zod, llama al service, responde con `lib/http/responses.ts`. Cero lógica de negocio. |
| `<nombre>.routes.ts` | `express.Router()`, mapea rutas a métodos del controller. |
| `index.ts` | La puerta pública del módulo: `createXModule({db, ...})` arma repository→service→controller→router y devuelve `{ service, repository, router }`. Sólo este archivo (y `*.schema.ts`) se importa desde afuera. |

## Ejemplo mínimo: `persona.schema.ts`

```ts
import { pgTable, integer, varchar, timestamp, primaryKey } from "drizzle-orm/pg-core";

export const personasTable = pgTable(
    "personas",
    {
        id: integer("id").generatedAlwaysAsIdentity().unique(),
        dni: varchar("dni", { length: 8 }).notNull(),
        nombre: varchar("nombre", { length: 60 }).notNull(),
        user: integer("user").notNull().references(() => usersTable.id),
        deletedAt: timestamp("deleted_at")
    },
    (table) => [primaryKey({ columns: [table.id, table.user] })]
);
```

Convenciones de schema:
- **PK compuesta `(id, user)`** en toda tabla que pertenece a un usuario:
  bradb arma el `WHERE` de `findOne`/`update`/`delete` con todas las
  columnas de la PK, así que un usuario nunca puede tocar una fila ajena
  aunque adivine el id.
- **Soft delete** vía columna `deletedAt` (`timestamp`, nullable):
  `ServiceBuilder` la detecta sola y excluye esas filas de `findOne`/
  `findAll` automáticamente. Ojo: eso también excluye la fila de un GET
  por id — si una historia necesita "borrado lógico pero consultable",
  no es este mecanismo, es un estado nuevo.

## `<nombre>.validator.ts`

```ts
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { createPkSchema } from "bradb";
import { z } from "zod";
import { personasTable } from "./persona.schema";

const select = createSelectSchema(personasTable);
const insert = createInsertSchema(personasTable).omit({ user: true, deletedAt: true });
const update = insert.partial();
const filter = z.object({ user: z.number() }).partial();
const pk = createPkSchema(personasTable).pick({ id: true });

export type PersonaInsert = z.infer<typeof insert>;
export type PersonaUpdate = z.infer<typeof update>;
export type Persona = z.infer<typeof select>;

export const personaValidator = { select, insert, update, filter, pk };
```

`insert` omite las columnas que pone el server (`user` viene del token,
no del body; `deletedAt` no se setea a mano). `pk` es sólo el id: `user`
lo agrega el controller desde `res.locals.user.id`.

## `<nombre>.filter.ts`

```ts
import { FilterMap } from "bradb";
import { eq } from "drizzle-orm";
import { personasTable } from "./persona.schema";
import { personaValidator } from "./persona.validator";

export const personaFilterMap: FilterMap<typeof personaValidator.filter> = {
    user: (val) => eq(personasTable.user, val)
};
```

## `<nombre>.repository.ts`

```ts
export function createPersonaRepository({ db }: { db: Database }) {
    const builder = new ServiceBuilder(db, personasTable, personaFilterMap);

    return {
        findOne: builder.findOne(),
        insert: builder.create(),
        update: builder.update(),
        remove: builder.delete(),
        // + queries custom (ej. `exists(dni, userId)`) que no cubre el builder
    };
}
export type PersonaRepository = ReturnType<typeof createPersonaRepository>;
```

`findOne`/`insert`/`update`/`remove` de bradb ya aceptan un `tx?` opcional
como último argumento — no hace falta escribirlo a mano.

## `<nombre>.service.ts`

```ts
export function createPersonaService({ repository }: { repository: PersonaRepository }) {
    const create = async (data: PersonaInsert & { user: number }) => {
        if (await repository.exists(data.dni, data.user)) {
            throw new Duplicated(`La persona con dni ${data.dni} ya se encuentra cargada`);
        }
        return repository.insert(data);
    };

    return { findOne: repository.findOne, create, /* ... */ };
}
export type PersonaService = ReturnType<typeof createPersonaService>;
```

Si un método del service no agrega lógica sobre el repository (es un
reenvío puro), no lo envuelvas: exponé `repository.findOne` directo en el
`return` (el linter tiene una regla que lo marca si no).

Errores: `NotFound`/`Duplicated`/`BadRequest`/`Forbidden`/`Unauthorized`
se importan directo de `"bradb"`. `ValidationError` (alias de
`BadRequest`), `NothingChanged` y `NotImplemented` están en
`src/lib/http/errors.ts`.

## `<nombre>.controller.ts` / `<nombre>.routes.ts`

```ts
export function createPersonaController({ service }: { service: PersonaService }) {
    const create: RequestHandler = async (req, res) => {
        const body = personaValidator.insert.parse(req.body);
        const persona = await service.create({ ...body, user: res.locals.user.id });
        created(res, persona, "Persona creada correctamente");
    };
    return { create /* ... */ };
}
```

```ts
export function createPersonaRoutes(controller: PersonaController) {
    const router = express.Router();
    router.post('/', controller.create);
    return router;
}
```

Helpers de respuesta (`src/lib/http/responses.ts`): `created`, `ok`,
`updated`, `deleted`, `list`, `success`.

## `index.ts`

```ts
export type { Persona, PersonaInsert, PersonaUpdate } from "./persona.validator";
export type { PersonaService } from "./persona.service";
export type { PersonaRepository } from "./persona.repository";

export function createPersonaModule({ db }: { db: Database }) {
    const repository = createPersonaRepository({ db });
    const service = createPersonaService({ repository });
    const controller = createPersonaController({ service });
    const router = createPersonaRoutes(controller);

    return { service, repository, router };
}
export type PersonaModule = ReturnType<typeof createPersonaModule>;
```

## Pasos para crear un módulo nuevo

1. `src/modules/<nombre>/<nombre>.schema.ts` — tabla de Drizzle.
2. Agregar el export de la tabla al barrel `src/db/schema.ts`.
3. `npm run db:generate` (genera la migración) y `npm run db:migrate` (la aplica).
4. `<nombre>.validator.ts`, `<nombre>.filter.ts`.
5. `<nombre>.repository.ts`.
6. `<nombre>.service.ts`.
7. `<nombre>.controller.ts`, `<nombre>.routes.ts`.
8. `index.ts` con `createXModule`.
9. Cablear el módulo nuevo en `src/container.ts` (agregarlo a `createContainer`, pasarle las dependencias de otros módulos si necesita).
10. Montarlo en `src/app.ts` (`app.use('/<prefix>', auth, container.<nombre>.router)`).
11. Si otro módulo necesita crear datos por defecto de éste (como `user` con sus clientes), o si éste necesita el repository/service de otro, ver la sección de arriba sobre dependencias entre módulos.
12. `npm run docs:api` para regenerar `docs/api.md` con las rutas nuevas.
13. Seeder en `seeders/<nombre>.seeder.ts` si el módulo necesita datos de prueba, cableado en `seeders/index.ts`.
14. Tests en `test/<nombre>.test.ts` (vitest + supertest, ver cualquier test existente como referencia de estilo).

## Verificación antes de dar por terminada una tarea

```
npx tsc --noEmit -p tsconfig.json   # tipos
npx eslint src/ seeders/            # estilo (incluye las reglas locales de eslint-rules/)
npx madge --circular --extensions ts src   # ciclos de imports
npm test                            # tests
```
