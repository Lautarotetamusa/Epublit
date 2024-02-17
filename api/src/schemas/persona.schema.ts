import {z} from "zod"

export const createPersona = z.object({
    nombre: z.string(),
    email: z.string().optional(),
    dni: z.string()
});

const personaSchema = createPersona.extend({
    id: z.number()
});

export const updatePersona = createPersona.partial();

export type CreatePersona = z.infer<typeof createPersona>;
export type UpdatePersona = z.infer<typeof updatePersona>;
export type PersonaSchema = z.infer<typeof personaSchema>;
