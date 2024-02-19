import {z} from 'zod';
import { libroPersonaSchema } from './libro_persona.schema';
import { personaSchema } from './persona.schema';

/*
    id INT(11) NOT NULL AUTO_INCREMENT,

    isbn VARCHAR(13) NOT NULL,
    id_persona INT(11) NOT NULL,
    tipo_persona TINYINT DEFAULT 0 NOT NULL,

    fecha_inicial DATE NOT NULL,
    fecha_final DATE NOT NULL,
    total FLOAT NOT NULL,
    file_path VARCHAR(80) NOT NULL,
*/

const liquidacionSchema = z.object({
    id: z.number(),
    isbn: z.string(),
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
    id: true
});
export type CreateLiquidacion = z.infer<typeof createLiquidacion>;

export type SaveLiquidacion = Omit<LiquidacionSchema, 'id'>;
