import {z} from 'zod';
import { createInsertSchema } from 'drizzle-zod';
import { librosPersonasTable } from './libroPersona.schema'

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
    id_persona: z.number(),
    id_libro: z.number()
});

// `isbn`/`id_libro` se resuelven server-side (del isbn de la URL), no vienen
// del body. `porcentaje` se sobreescribe como requerido: la columna tiene
// `default(0)` en `librosPersonasTable`, así que `createInsertSchema` lo
// marcaría opcional, y sin esto "no enviado" y "enviado como 0" serían
// indistinguibles (el bug que este módulo corrige, ver plan).
const body = createInsertSchema(librosPersonasTable, {
    porcentaje: z.number().min(0).max(100)
}).omit({ isbn: true, id_libro: true });
const bodyBatch = body.or(z.array(body).min(1));
const removeBody = body.pick({ id_persona: true, tipo: true });
const removeBatch = removeBody.or(z.array(removeBody).min(1));

export type LibroPersonaBody = z.infer<typeof body>;
export type LibroPersonaBodyBatch = z.infer<typeof bodyBatch>;
export type LibroPersonaRemoveBody = z.infer<typeof removeBody>;
export type LibroPersonaRemoveBatch = z.infer<typeof removeBatch>;

export const libroPersonaValidator = {
    body,
    bodyBatch,
    removeBody,
    removeBatch
};
