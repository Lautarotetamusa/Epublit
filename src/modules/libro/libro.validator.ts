import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { createPkSchema } from "bradb";
import { librosTable } from "./libro.schema";
import {z} from 'zod';

// Validators nuevos (Postgres/Drizzle), usados por libro.controller.ts/libro.service.ts.
const select = createSelectSchema(librosTable);
const insert = createInsertSchema(librosTable).omit({
    user: true,
    deletedAt: true
});
const update = insert.partial();
const filter = z
    .object({
        user: z.number(),
        isbn: z.string(),
        titulo: z.string(),
        precio: z.coerce.number(),
        stock: z.coerce.number()
    })
    .partial();
const pk = createPkSchema(librosTable).pick({
    id_libro: true
});

export type LibroInsert = z.infer<typeof insert>;
export type LibroUpdate = z.infer<typeof update>;
export type Libro = z.infer<typeof select>;
export type LibroFilter = z.infer<typeof filter>;

export const libroValidator = {
    select,
    insert,
    update,
    filter,
    pk
};

// Validators viejos (MySQL): sólo `libroSchema`/`libroCantidad` sobreviven,
// todavía usados por `src/modules/transaccion/operacion.config.ts` (vía
// `createTransaccion`/`createVenta`/`createVentaConsignado`, zod puro sin
// dependencia de MySQL) y por `src/modules/transaccion/transaccion.validator.ts`.
// El resto del bloque (usado sólo por los `.model.ts` MySQL) se dio de baja
// junto con esos modelos.
const libroSchema = z.object({
    titulo: z.string(),
    isbn: z.string(),
    id_libro: z.number(),
    precio: z.number(),
    fecha_edicion: z.coerce.date(),
    stock: z.number(),
    user: z.number()
});

export const libroCantidad = libroSchema.pick({
    isbn: true
}).and(z.object({
    cantidad: z.number().min(1)
}));
export type LibroCantidad = z.infer<typeof libroCantidad>;
