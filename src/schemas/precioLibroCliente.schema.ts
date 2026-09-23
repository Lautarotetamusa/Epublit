import { pgTable, integer, real, timestamp, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { librosTable } from "./libros.schema";
import { clientesTable } from "./clientes.schema";

export const precioLibroClienteTable = pgTable(
    "precio_libro_cliente",
    {
        id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
        id_libro: integer("id_libro")
            .notNull()
            .references(() => librosTable.id_libro),
        id_cliente: integer("id_cliente")
            .notNull()
            .references(() => clientesTable.id),
        precio: real("precio").notNull(),
        created_at: timestamp("created_at").notNull().defaultNow()
    },
    (table) => [check("precio_no_negativo", sql`${table.precio} >= 0`)]
);
