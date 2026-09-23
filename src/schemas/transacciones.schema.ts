import { pgTable, integer, varchar, timestamp, primaryKey, pgEnum } from "drizzle-orm/pg-core";
import { clientesTable } from "./clientes.schema";
import { usersTable } from "./users.schema";

export const transaccionTipoEnum = pgEnum("transaccion_tipo", [
    "venta",
    "consignacion",
    "ventaConsignacion",
    "devolucion"
]);

export const transaccionesTable = pgTable(
    "transacciones",
    {
        // `.unique()` además de la PK compuesta: ventas.id_transaccion y
        // libros_transacciones.id_transaccion referencian esta columna sola,
        // y Postgres exige unicidad para el FK.
        id: integer("id").generatedAlwaysAsIdentity().unique(),
        fecha: timestamp("fecha").notNull().defaultNow(),
        id_cliente: integer("id_cliente")
            .notNull()
            .references(() => clientesTable.id),
        file_path: varchar("file_path", { length: 80 }).notNull(),
        type: transaccionTipoEnum("type").notNull(),
        user: integer("user")
            .notNull()
            .references(() => usersTable.id)
    },
    (table) => [
        // PK compuesta (id, user), mismo patrón que clientesTable en 004:
        // ninguna transacción/venta se puede traer por id suelto sin pasar
        // también por su dueño.
        primaryKey({ columns: [table.id, table.user] })
    ]
);
