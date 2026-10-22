import { createSelectSchema } from "drizzle-zod";
import { createPkSchema } from "bradb";
import { z } from "zod";
import { rolesTable } from "./rol.schema";

// `createInsertSchema` aceptaría un nombre vacío (""); el plan pide 400 si
// falta o si viene vacío/sólo espacios, así que se exige al menos un carácter
// (`.trim()` normaliza antes de medir).
const nombre = z.string().trim().min(1, "El nombre es obligatorio");

const select = createSelectSchema(rolesTable);
// `.strict()`: el body no puede traer `id`/`user`/`deletedAt` (internos).
const insert = z.object({ nombre }).strict();
const update = z.object({ nombre }).strict();
const filter = z.object({ user: z.number() }).partial();
const pk = createPkSchema(rolesTable).pick({ id: true });

// `RolRow` es la fila completa (incluye internos); `Rol` es la forma pública
// que exponen la API y las lecturas de libro/persona/liquidación
// ({ id, nombre }).
export type RolRow = z.infer<typeof select>;
export type Rol = Pick<RolRow, "id" | "nombre">;
export type RolInsert = z.infer<typeof insert>;
export type RolUpdate = z.infer<typeof update>;

export const rolValidator = {
    select,
    insert,
    update,
    filter,
    pk
};
