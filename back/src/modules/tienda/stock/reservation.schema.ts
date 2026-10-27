import { check, foreignKey, index, integer, pgEnum, pgTable, primaryKey, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { ordersTable } from "../order/order.schema";
import { librosTable } from "../../libro/libro.schema";
import { depositosTable } from "../../deposito/deposito.schema";

export const reservationStatusEnum = pgEnum("reserva_estado", ["activa", "liberada", "convertida"]);

// Reserva de stock del depósito principal mientras el pedido espera el pago.
// Al aceptar el pedido se convierte (deja de restarse y el stock físico baja);
// al rechazar/cancelar/expirar se libera.
export const reservationsTable = pgTable(
    "reservas",
    {
        id: integer("id").generatedAlwaysAsIdentity().unique(),
        user: integer("user").notNull(),
        pedido_id: integer("pedido_id").notNull(),
        id_libro: integer("id_libro").notNull(),
        deposito_id: integer("deposito_id").notNull(),
        cantidad: integer("cantidad").notNull(),
        estado: reservationStatusEnum("estado").notNull().default("activa"),
        expira_en: timestamp("expira_en").notNull(),
        creada_en: timestamp("creada_en").notNull().defaultNow(),
        actualizada_en: timestamp("actualizada_en").notNull().defaultNow()
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
        foreignKey({
            columns: [table.deposito_id, table.user],
            foreignColumns: [depositosTable.id, depositosTable.user]
        }),
        uniqueIndex("reservas_pedido_libro_idx").on(table.pedido_id, table.id_libro),
        index("reservas_user_libro_estado_idx").on(table.user, table.id_libro, table.estado),
        index("reservas_estado_expira_idx").on(table.estado, table.expira_en),
        check("reservas_cantidad_positiva", sql`${table.cantidad} > 0`)
    ]
);
