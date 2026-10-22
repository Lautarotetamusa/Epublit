import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { createPkSchema } from "bradb";
import { z } from "zod";
import { depositosTable } from "./deposito.schema";

// `createInsertSchema` aceptaría un nombre vacío (""); el plan pide 400 tanto
// si falta como si viene vacío, así que se exige al menos un carácter.
const nombre = z.string().trim().min(1, "El nombre es obligatorio");

const select = createSelectSchema(depositosTable);
// `.strict()`: el flag `principal` es de sólo lectura y el body no puede
// traerlo (tampoco `id`/`user`/`deletedAt`, que son internos).
const body = createInsertSchema(depositosTable, { nombre })
    .omit({ principal: true, user: true, deletedAt: true, id_cliente: true })
    .strict();
// Alta y edición comparten forma: en ambas el nombre es obligatorio y la
// descripción opcional (`null` explícito la pisa).
const insert = body;
const update = body;
const filter = z.object({ user: z.number() }).partial();
const pk = createPkSchema(depositosTable).pick({ id: true });

export type Deposito = z.infer<typeof select>;
export type DepositoInsert = z.infer<typeof insert>;
export type DepositoUpdate = z.infer<typeof update>;

export const depositoValidator = {
    select,
    insert,
    update,
    filter,
    pk
};
