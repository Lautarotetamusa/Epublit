import { createSelectSchema } from "drizzle-zod";
import { createPkSchema } from "bradb";
import { z } from "zod";
import { tiposEdicionTable } from "./tipoEdicion.schema";

// `createInsertSchema` aceptaría un nombre vacío (""); el contrato pide 400 si
// falta o si viene vacío/sólo espacios, así que se exige al menos un carácter
// (`.trim()` normaliza antes de medir).
const nombre = z.string().trim().min(1, "El nombre es obligatorio");

const select = createSelectSchema(tiposEdicionTable);
// `.strict()`: el body no puede traer `id`/`user`/`deletedAt` (internos).
const insert = z.object({ nombre }).strict();
const update = z.object({ nombre }).strict();
const filter = z.object({ user: z.number() }).partial();
const pk = createPkSchema(tiposEdicionTable).pick({ id: true });

// `TipoEdicionRow` es la fila completa (incluye internos); `TipoEdicion` es la
// forma pública que exponen la API y las lecturas de libro ({ id, nombre }).
export type TipoEdicionRow = z.infer<typeof select>;
export type TipoEdicion = Pick<TipoEdicionRow, "id" | "nombre">;
export type TipoEdicionInsert = z.infer<typeof insert>;
export type TipoEdicionUpdate = z.infer<typeof update>;

export const tipoEdicionValidator = {
    select,
    insert,
    update,
    filter,
    pk
};
