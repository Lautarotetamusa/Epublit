import { foreignKey, index, integer, pgTable, primaryKey, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { ordersTable } from "./order.schema";

// Hitos del pedido (creación, pago, aceptación, rechazo, envío, entrega,
// cancelación). Se conservan aunque el pedido esté en un estado terminal.
export const orderHistoryTable = pgTable(
    "pedido_historial",
    {
        id: integer("id").generatedAlwaysAsIdentity().unique(),
        user: integer("user").notNull(),
        pedido_id: integer("pedido_id").notNull(),
        tipo: varchar("tipo", { length: 40 }).notNull(),
        descripcion: text("descripcion").notNull(),
        fecha: timestamp("fecha").notNull().defaultNow()
    },
    (table) => [
        primaryKey({ columns: [table.id, table.user] }),
        foreignKey({
            columns: [table.pedido_id, table.user],
            foreignColumns: [ordersTable.id, ordersTable.user]
        }),
        index("pedido_historial_pedido_fecha_idx").on(table.pedido_id, table.fecha)
    ]
);
