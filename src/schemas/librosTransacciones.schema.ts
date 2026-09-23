import { pgTable, integer, real, primaryKey, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { transaccionesTable } from "./transacciones.schema";
import { librosTable } from "./libros.schema";

export const librosTransaccionesTable = pgTable(
    "libros_transacciones",
    {
        id_transaccion: integer("id_transaccion")
            .notNull()
            .references(() => transaccionesTable.id),
        id_libro: integer("id_libro")
            .notNull()
            .references(() => librosTable.id_libro),
        cantidad: integer("cantidad").notNull(),
        precio: real("precio").notNull().default(0)
    },
    (table) => [
        primaryKey({ columns: [table.id_libro, table.id_transaccion] }),
        check("cantidad_positiva", sql`${table.cantidad} > 0`),
        check("precio_no_negativo", sql`${table.precio} >= 0`)
    ]
);
