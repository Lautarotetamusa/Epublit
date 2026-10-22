import { pgTable, integer, varchar, real, primaryKey } from "drizzle-orm/pg-core";
import { clientesTable } from "./cliente.schema";
import { librosTable } from "../libro/libro.schema";

// Precio congelado por cliente/libro: el stock consignado vive en el depósito
// propio del cliente (ver specs/009-ledger-unificado), no acá. Esta tabla sólo
// guarda el último precio congelado; su historial está en
// `precio_libro_cliente`.
export const libroClienteTable = pgTable(
    "libro_cliente",
    {
        id_cliente: integer("id_cliente")
            .notNull()
            .references(() => clientesTable.id),
        isbn: varchar("isbn", { length: 13 }).notNull(),
        id_libro: integer("id_libro")
            .notNull()
            .references(() => librosTable.id_libro),
        precio: real("precio").notNull()
    },
    (table) => [
        primaryKey({ columns: [table.id_libro, table.id_cliente] })
    ]
);
