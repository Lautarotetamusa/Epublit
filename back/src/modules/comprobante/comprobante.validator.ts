import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { comprobantesTable, facturasTable } from "./comprobante.schema";

const select = createSelectSchema(comprobantesTable);
const insert = createInsertSchema(comprobantesTable);

const facturaSelect = createSelectSchema(facturasTable);
const facturaInsert = createInsertSchema(facturasTable);

const pk = z
    .object({
        id: z.coerce.number().int().positive()
    })
    .strict();

export type ComprobanteRow = z.infer<typeof select>;
export type ComprobanteInsert = z.infer<typeof insert>;
export type FacturaRow = z.infer<typeof facturaSelect>;
export type FacturaInsert = z.infer<typeof facturaInsert>;

export const comprobanteValidator = {
    select,
    insert,
    facturaSelect,
    facturaInsert,
    pk
};

export const comprobantePk = pk;
