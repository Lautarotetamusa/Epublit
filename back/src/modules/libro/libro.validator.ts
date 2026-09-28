import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { createPkSchema } from "bradb";
import { librosTable } from "./libro.schema";
import {z} from 'zod';

// Matchea youtube.com/watch?v=..., youtube.com/embed/... y youtu.be/...
// (con o sin protocolo/www), ver plan specs/003-libro-campos-extendidos.
const YOUTUBE_URL_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/)|youtu\.be\/)\S+$/i;

// Campos extendidos: todos opcionales (pueden omitirse o venir `null`), con
// su propia validación cuando sí vienen cargados.
const positiveNumber = z.number().positive().nullable().optional();
const positiveInt = z.number().int().positive().nullable().optional();
const nonNegativeInt = z.number().int().nonnegative().nullable().optional();
const bookTrailerUrl = z
    .string()
    .nullable()
    .optional()
    .refine((value) => !value || YOUTUBE_URL_REGEX.test(value), {
        message: "book_trailer_url debe ser un link de YouTube válido"
    });

// Validators nuevos (Postgres/Drizzle), usados por libro.controller.ts/libro.service.ts.
const select = createSelectSchema(librosTable);
const insert = createInsertSchema(librosTable, {
    alto: positiveNumber,
    ancho: positiveNumber,
    largo: positiveNumber,
    paginas: positiveInt,
    edad_recomendada: nonNegativeInt,
    book_trailer_url: bookTrailerUrl
}).omit({
    user: true,
    deletedAt: true,
    // `portada_key` es interno (key de storage): se setea sólo desde
    // `service.uploadPortada`, nunca desde el body de create/update.
    portada_key: true
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
