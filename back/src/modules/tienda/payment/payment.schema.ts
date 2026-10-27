import { check, foreignKey, index, integer, jsonb, pgEnum, pgTable, primaryKey, real, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { ordersTable } from "../order/order.schema";

export const paymentStatusEnum = pgEnum("pago_estado", ["pendiente", "aprobado", "rechazado", "reembolsado"]);

// Intento de pago de Checkout Pro. Se conservan todos los intentos (una nueva
// preferencia no pisa al anterior) y el `pago_id` externo es único.
export const paymentsTable = pgTable(
    "pagos",
    {
        id: integer("id").generatedAlwaysAsIdentity().unique(),
        user: integer("user").notNull(),
        pedido_id: integer("pedido_id").notNull(),
        proveedor: varchar("proveedor", { length: 30 }).notNull().default("mercadopago"),
        pago_id: varchar("pago_id", { length: 120 }),
        preferencia_id: varchar("preferencia_id", { length: 120 }),
        init_point: text("init_point"),
        estado: paymentStatusEnum("estado").notNull().default("pendiente"),
        importe: real("importe").notNull(),
        moneda: varchar("moneda", { length: 3 }).notNull().default("ARS"),
        vence_en: timestamp("vence_en"),
        fecha_pago: timestamp("fecha_pago"),
        datos: jsonb("datos"),
        datos_reembolso: jsonb("datos_reembolso"),
        creado_en: timestamp("creado_en").notNull().defaultNow(),
        actualizado_en: timestamp("actualizado_en").notNull().defaultNow()
    },
    (table) => [
        primaryKey({ columns: [table.id, table.user] }),
        foreignKey({
            columns: [table.pedido_id, table.user],
            foreignColumns: [ordersTable.id, ordersTable.user]
        }),
        // Un pago externo solo puede pertenecer a un intento.
        uniqueIndex("pagos_pago_id_idx")
            .on(table.pago_id)
            .where(sql`${table.pago_id} is not null`),
        index("pagos_pedido_idx").on(table.pedido_id, table.creado_en),
        index("pagos_preferencia_idx").on(table.preferencia_id),
        check("pagos_importe_no_negativo", sql`${table.importe} >= 0`)
    ]
);

// Eventos de webhook ya procesados: la deduplicación es global por proveedor
// e identificador de evento, independiente de la cuenta que lo recibe.
export const webhookEventsTable = pgTable(
    "webhook_eventos",
    {
        id: integer("id").generatedAlwaysAsIdentity().unique(),
        proveedor: varchar("proveedor", { length: 30 }).notNull(),
        evento_id: varchar("evento_id", { length: 200 }).notNull(),
        tipo: varchar("tipo", { length: 80 }),
        payload: jsonb("payload"),
        user: integer("user"),
        procesado_en: timestamp("procesado_en"),
        creado_en: timestamp("creado_en").notNull().defaultNow()
    },
    (table) => [
        uniqueIndex("webhook_eventos_proveedor_evento_idx").on(table.proveedor, table.evento_id),
        index("webhook_eventos_user_idx").on(table.user)
    ]
);
