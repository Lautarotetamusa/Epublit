import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { createPkSchema } from "bradb";
import { z } from "zod";
import { coleccionesTable } from "./coleccion.schema";

// `createInsertSchema` aceptaría un título vacío (""); el plan pide 400 tanto
// si falta como si viene vacío, así que se exige al menos un carácter.
const titulo = z.string().trim().min(1, "El título es obligatorio");

const select = createSelectSchema(coleccionesTable);
const body = createInsertSchema(coleccionesTable, { titulo }).omit({
    user: true,
    deletedAt: true,
    // `portada_key` es interno (key de storage): se setea sólo desde
    // `service.uploadPortada`/`service.removePortada`, nunca desde el body.
    portada_key: true
});
// Alta y edición comparten forma: en ambas el título es obligatorio y la
// descripción opcional (`null` explícito la pisa).
const insert = body;
const update = body;
const filter = z.object({ user: z.number() }).partial();
const pk = createPkSchema(coleccionesTable).pick({ id: true });

export type ColeccionInsert = z.infer<typeof insert>;
export type ColeccionUpdate = z.infer<typeof update>;
export type Coleccion = z.infer<typeof select>;

export const coleccionValidator = {
    select,
    insert,
    update,
    filter,
    pk
};
