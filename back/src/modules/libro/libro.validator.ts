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

// Límite de stock negativo permitido (ver specs/016-tienda-ecommerce): entero
// no negativo, con el rango de un `integer` de Postgres. No acepta strings ni
// decimales, y `null` tampoco (el valor por defecto es 0).
const stockNegativoPermitido = z.number().int().min(0).max(2147483647);

// Peso opcional en kg. Se redondea a gramos (tres decimales) antes de
// persistir; `null` limpia el valor y `undefined` lo conserva al editar.
const pesoKg = z.number().positive().max(1_000_000).nullable().optional();

// Validators nuevos (Postgres/Drizzle), usados por libro.controller.ts/libro.service.ts.
const select = createSelectSchema(librosTable);
const insert = createInsertSchema(librosTable, {
    alto: positiveNumber,
    ancho: positiveNumber,
    largo: positiveNumber,
    paginas: positiveInt,
    edad_recomendada: nonNegativeInt,
    book_trailer_url: bookTrailerUrl,
    stock_negativo_permitido: stockNegativoPermitido.optional(),
    peso_kg: pesoKg
}).omit({
    user: true,
    deletedAt: true,
    // `portada_key` es interno (key de storage): se setea sólo desde
    // `service.uploadPortada`, nunca desde el body de create/update.
    portada_key: true,
    // El stock ya no es un dato editable del libro: vive sólo como cantidad
    // por depósito y se mueve con movimientos (ver specs/008-movimientos-deposito).
    stock: true
    // `.strict()` para que mandar `stock` (u otro campo desconocido) sea 400,
    // no un campo ignorado en silencio.
}).strict();
const update = insert.partial();
const filter = z
    .object({
        user: z.number(),
        isbn: z.string(),
        titulo: z.string(),
        precio: z.coerce.number(),
        stock: z.coerce.number(),
        // Búsqueda del catálogo público: título o ISBN, parcial e insensible
        // a mayúsculas.
        buscar: z.string().trim().min(1),
        // `z.coerce.boolean()` convertiría "false" en `true` (cualquier string
        // no vacío es truthy): se parsea explícito desde el string de la query.
        sin_coleccion: z.enum(["true", "false"]).transform((value) => value === "true")
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
