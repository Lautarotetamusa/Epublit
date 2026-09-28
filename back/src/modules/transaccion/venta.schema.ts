import { pgTable, integer, real, pgEnum } from "drizzle-orm/pg-core";
import { transaccionesTable } from "./transaccion.schema";

export const medioPagoEnum = pgEnum("medio_pago", [
    "efectivo",
    "debito",
    "credito",
    "mercadopago",
    "transferencia"
]);

export const ventasTable = pgTable("ventas", {
    descuento: real("descuento").default(0),
    total: real("total").notNull(),
    medio_pago: medioPagoEnum("medio_pago"),
    tipo_cbte: integer("tipo_cbte").notNull(),
    id_transaccion: integer("id_transaccion")
        .primaryKey()
        .references(() => transaccionesTable.id)
});
