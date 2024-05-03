import { createLibroPersona, createlibroPersonaInDB } from './libro_persona.schema';
import {z} from 'zod';

export const libroSchema = z.object({
    titulo: z.string(),
    isbn: z.string(),
    id_libro: z.number(),
    precio: z.number(),
    fecha_edicion: z.coerce.date(),
    stock: z.number(),
    user: z.number()
});
export type LibroSchema = z.infer<typeof libroSchema>;

export type SaveLibro = Omit<LibroSchema, 'id_libro'>;

export const libroCantidad = libroSchema.pick({
    isbn: true
}).and(z.object({
    cantidad: z.number().min(1)
}));
export type LibroCantidad = z.infer<typeof libroCantidad>;

const libroPrecio = libroSchema.pick({
    isbn: true,
    precio: true,
    user: true,
    id_libro: true,
});
export type CreateLibroPrecio = z.infer<typeof libroPrecio>;

export const createLibro = libroSchema.extend({
    autores: z.array(createlibroPersonaInDB.or(createLibroPersona)),
    ilustradores: z.array(createlibroPersonaInDB.or(createLibroPersona))
}).omit({
    user: true,
    id_libro: true
});
type CreateLibro = z.infer<typeof createLibro>;

export const updateLibro = libroSchema.omit({
    isbn: true,
    user: true
}).partial();
export type UpdateLibro = Partial<LibroSchema>;
