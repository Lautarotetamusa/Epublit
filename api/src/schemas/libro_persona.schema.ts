import {z} from 'zod';
import { createPersona, personaSchema } from './persona.schema'

export const tipoPersona = {
    autor: "autor",
    ilustrador: "ilustrador"
}  as const;
export type TipoPersona = keyof typeof tipoPersona;
const tipoPersonaKeys = Object.keys(tipoPersona) as [TipoPersona];

export const libroPersonaSchema = z.object({
    porcentaje: z.number().min(0).max(100),
    tipo: z.enum(tipoPersonaKeys),
    isbn: z.string(),
    id_persona: z.number()
});
export type LibroPersonaSchema = z.infer<typeof libroPersonaSchema>;

const personaLibroPersonaSchema = personaSchema.and(libroPersonaSchema);
export type PersonaLibroPersonaSchema = z.infer<typeof personaLibroPersonaSchema>;

export const libroPersonaKey = libroPersonaSchema.omit({
    porcentaje: true
});
export type LibroPersonaKey = z.infer<typeof libroPersonaKey>;

export const createlibroPersonaInDB = libroPersonaSchema.omit({
    isbn: true,
    tipo: true
});
export const createLibroPersona = createPersona.and(libroPersonaSchema.omit({
    id_persona: true,
    isbn: true,
    tipo: true
}));
export type CreateLibroPersona = z.infer<typeof createLibroPersona>;
