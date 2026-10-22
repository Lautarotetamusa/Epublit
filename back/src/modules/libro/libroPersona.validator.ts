import { z } from 'zod';

// `rol` es el id del rol de la cuenta con el que la persona trabaja en el
// libro (ver specs/011-roles): reemplaza al enum fijo `autor | ilustrador` que
// identificaba la relación. `isbn`/`id_libro` se resuelven server-side (del
// isbn de la URL), no vienen del body.
const body = z.object({
    id_persona: z.number(),
    rol: z.number(),
    porcentaje: z.number().min(0).max(100),
    // Monto acordado del anticipo (opcional): se copia como snapshot al
    // generarse el anticipo en el lanzamiento del libro (ver
    // specs/012-liquidaciones-pagos, tarea 3).
    monto_acordado: z.number().min(0).optional()
});
const bodyBatch = body.or(z.array(body).min(1));
const removeBody = body.pick({ id_persona: true, rol: true });
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
