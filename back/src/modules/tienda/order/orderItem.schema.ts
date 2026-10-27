import { check, foreignKey, integer, pgTable, primaryKey, real, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { ordersTable } from "./order.schema";
import { librosTable } from "../../libro/libro.schema";

// Línea congelada del pedido: título, precio y subtotal del momento de la
// compra, independientes de cambios posteriores en el libro.
export const orderItemsTable = pgTable(
    "pedido_items",
    {
        id: integer("id").generatedAlwaysAsIdentity().unique(),
        user: integer("user").notNull(),
        pedido_id: integer("pedido_id").notNull(),
        // Referencia interna congelada al libro: la aceptación genera el
        // movimiento sin volver a resolver el ISBN (el libro puede haberse
        // dado de baja después del checkout).
        id_libro: integer("id_libro"),
        isbn: varchar("isbn", { length: 13 }).notNull(),
        titulo: varchar("titulo", { length: 200 }).notNull(),
        precio_unitario: real("precio_unitario").notNull(),
        cantidad: integer("cantidad").notNull(),
        subtotal: real("subtotal").notNull()
    },
    (table) => [
        primaryKey({ columns: [table.id, table.user] }),
        foreignKey({
            columns: [table.pedido_id, table.user],
            foreignColumns: [ordersTable.id, ordersTable.user]
        }),
        foreignKey({
            columns: [table.id_libro, table.user],
            foreignColumns: [librosTable.id_libro, librosTable.user]
        }),
        uniqueIndex("pedido_items_pedido_isbn_idx").on(table.pedido_id, table.isbn),
        check("pedido_items_cantidad_positiva", sql`${table.cantidad} > 0`),
        check("pedido_items_precio_no_negativo", sql`${table.precio_unitario} >= 0`),
        check("pedido_items_subtotal_no_negativo", sql`${table.subtotal} >= 0`)
    ]
);
