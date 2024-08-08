import {z} from 'zod';
import { libroPersonaSchema } from './libro_persona.schema';
import { personaSchema } from './persona.schema';

const liquidacionSchema = z.object({
    id: z.number(),
    isbn: z.string(),
    id_libro: z.number(),
    id_persona: personaSchema.shape.id,
    tipo_persona: libroPersonaSchema.shape.tipo,
    fecha_inicial: z.date(),
    fecha_final: z.date(),
    total: z.number().min(0),
    file_path: z.string()
});
export type LiquidacionSchema = z.infer<typeof liquidacionSchema>;

export const createLiquidacion = liquidacionSchema.omit({
    total: true,
    file_path: true,
    id: true,
    id_libro: true
});
export type CreateLiquidacion = z.infer<typeof createLiquidacion>;

export type SaveLiquidacion = Omit<LiquidacionSchema, 'id'>;
