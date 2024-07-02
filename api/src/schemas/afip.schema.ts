import {z} from 'zod';

export const afipSchema = z.object({
    ingresos_brutos: z.boolean(),
    fecha_inicio: z.string(),
    razon_social: z.string(),
    cond_fiscal: z.string(),
    domicilio: z.string(),
});

export type AfipData = z.infer<typeof afipSchema>;
