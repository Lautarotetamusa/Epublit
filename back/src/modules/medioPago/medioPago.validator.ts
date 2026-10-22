import { createSelectSchema } from "drizzle-zod";
import { createPkSchema } from "bradb";
import { z } from "zod";
import { mediosPagoTable } from "./medioPago.schema";

// `createInsertSchema` aceptaría un nombre vacío (""); el plan pide 400 si
// falta o si viene vacío/sólo espacios, así que se exige al menos un carácter
// (`.trim()` normaliza antes de medir).
const nombre = z.string().trim().min(1, "El nombre es obligatorio");
const comision = z.number().min(0, "La comisión no puede ser menor a 0").max(100, "La comisión no puede ser mayor a 100");

const select = createSelectSchema(mediosPagoTable);
// `.strict()`: el body no puede traer `id`/`user`/`deletedAt` (internos).
const insert = z
    .object({
        nombre,
        comision: comision.default(0)
    })
    .strict();
const update = z
    .object({
        nombre: nombre.optional(),
        comision: comision.optional()
    })
    .strict();
const filter = z.object({ user: z.number() }).partial();
const pk = createPkSchema(mediosPagoTable).pick({ id: true });

// `MedioPagoRow` es la fila completa (incluye internos); `MedioPago` es la
// forma pública que exponen la API y las ventas ({ id, nombre, comision }).
export type MedioPagoRow = z.infer<typeof select>;
export type MedioPago = Pick<MedioPagoRow, "id" | "nombre" | "comision">;
export type MedioPagoInsert = z.infer<typeof insert>;
export type MedioPagoUpdate = z.infer<typeof update>;

export const medioPagoValidator = {
    select,
    insert,
    update,
    filter,
    pk
};
