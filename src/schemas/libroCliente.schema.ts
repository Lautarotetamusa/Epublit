import { pgTable, integer, varchar, real, primaryKey } from "drizzle-orm/pg-core";
import { clientesTable } from "./clientes.schema";
import { librosTable } from "./libros.schema";

export const libroClienteTable = pgTable(
    "libro_cliente",
    {
        id_cliente: integer("id_cliente")
            .notNull()
            .references(() => clientesTable.id),
        isbn: varchar("isbn", { length: 13 }).notNull(),
        stock: integer("stock").notNull(),
        id_libro: integer("id_libro")
            .notNull()
            .references(() => librosTable.id_libro),
        precio: real("precio").notNull()
    },
    (table) => [
        primaryKey({ columns: [table.id_libro, table.id_cliente] })
    ]
);
