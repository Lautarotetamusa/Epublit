import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { createPkSchema } from "bradb";
import { z } from "zod";
import { clientesTable } from "./cliente.schema";

export const tipoCliente = {
    particular: "particular",
    inscripto: "inscripto",
    negro: "negro"
} as const;
export type TipoCliente = keyof typeof tipoCliente;

// Validators nuevos (Postgres/Drizzle), usados por cliente.controller.ts/cliente.service.ts.
const select = createSelectSchema(clientesTable);
// Se omite `tipo` (en vez de aceptarlo e ignorarlo a mano) para que "enviar
// `tipo` en el body no tiene efecto" (spec, casos borde) sea una garantía del
// schema: zod descarta claves no declaradas por default.
const insert = createInsertSchema(clientesTable)
    .omit({
        user: true,
        deletedAt: true,
        cond_fiscal: true,
        razon_social: true,
        domicilio: true,
        tipo: true
    })
    // `cuit` es nullable a nivel de columna (un cliente "particular"/"negro"
    // no tiene cuit propio), pero `POST /cliente` sólo da de alta clientes
    // "inscripto" (ver cliente.service.ts#create), que siempre lo requieren.
    .extend({ cuit: z.string() });
const update = insert.partial();
const filter = z
    .object({
        user: z.number(),
        tipo: z.enum(Object.keys(tipoCliente) as [TipoCliente])
    })
    .partial();
const pk = createPkSchema(clientesTable).pick({
    id: true
});

export type ClienteInsert = z.infer<typeof insert>;
export type ClienteUpdate = z.infer<typeof update>;
// El tipo que reemplaza a la clase `Cliente` (MySQL) en las firmas de
// `venta`/`transaccion`/`comprobante`/`Afip`.
export type Client = z.infer<typeof select>;

export const clienteValidator = {
    select,
    insert,
    update,
    filter,
    pk
};
