import {z} from "zod"

export const createPersona = z.object({
    nombre: z.string(),
    email: z.string().optional(),
    dni: z.string(),
});

export const personaSchema = createPersona.extend({
    id: z.number(),
    user: z.number()
});

export const savePersona = personaSchema.omit({
    id: true
});

export const updatePersona = createPersona.partial();

export type SavePersona   = z.infer<typeof savePersona>;
export type CreatePersona = z.infer<typeof createPersona>;
export type UpdatePersona = z.infer<typeof updatePersona>;
export type PersonaSchema = z.infer<typeof personaSchema>;
