import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { anticiposTable } from "./anticipo.schema";

const select = createSelectSchema(anticiposTable);

// Pago único: no hay monto ni parciales que decidir (ver
// specs/012-liquidaciones-pagos). La fecha es opcional (por defecto hoy).
const pagar = z
    .object({
        fecha: z.iso.date().optional()
    })
    .strict();

const pk = z.object({ id: z.coerce.number().int().positive() });

export type AnticipoRow = z.infer<typeof select>;
export type AnticipoPagar = z.infer<typeof pagar>;

export const anticipoValidator = {
    select,
    pagar,
    pk
};
