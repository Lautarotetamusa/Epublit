import { createLibroPersona, libroPersonaSchema } from './libro_persona.schema';
import {z} from 'zod';

export const libroSchema = z.object({
    titulo: z.string(),
    isbn: z.string(),
    precio: z.number(),
    fecha_edicion: z.date(),
    stock: z.number()
});
export type LibroSchema = z.infer<typeof libroSchema>;

export const libroCantidad = libroSchema.pick({
    isbn: true
}).and(z.object({
    cantidad: z.number().min(1)
}));
export type LibroCantidad = z.infer<typeof libroCantidad>;

export const createLibro = libroSchema.extend({
    personas: z.array(libroPersonaSchema.or(createLibroPersona))
});
type CreateLibro = z.infer<typeof createLibro>;

export const updateLibro = libroSchema.partial();
export type UpdateLibro = Partial<LibroSchema>;
