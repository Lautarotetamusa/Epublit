import { foreignKey, index, integer, pgTable, primaryKey, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { ordersTable } from "../order/order.schema";

// Envío de MiCorreo asociado a un pedido aceptado con entrega a domicilio.
// Idempotente por pedido: la generación reutiliza la fila existente.
export const shipmentsTable = pgTable(
    "envios",
    {
        id: integer("id").generatedAlwaysAsIdentity().unique(),
        user: integer("user").notNull(),
        pedido_id: integer("pedido_id").notNull(),
        proveedor: varchar("proveedor", { length: 30 }).notNull().default("paqar"),
        proveedor_envio_id: varchar("proveedor_envio_id", { length: 120 }),
        codigo_seguimiento: varchar("codigo_seguimiento", { length: 120 }),
        estado: varchar("estado", { length: 80 }),
        ultima_actualizacion: timestamp("ultima_actualizacion"),
        url_seguimiento: text("url_seguimiento"),
        etiqueta_file_path: text("etiqueta_file_path"),
        etiqueta_url: text("etiqueta_url"),
        etiqueta_creada_en: timestamp("etiqueta_creada_en"),
        despachado_en: timestamp("despachado_en"),
        creado_en: timestamp("creado_en").notNull().defaultNow(),
        actualizado_en: timestamp("actualizado_en").notNull().defaultNow()
    },
    (table) => [
        primaryKey({ columns: [table.id, table.user] }),
        foreignKey({
            columns: [table.pedido_id, table.user],
            foreignColumns: [ordersTable.id, ordersTable.user]
        }),
        uniqueIndex("envios_pedido_idx").on(table.pedido_id),
        uniqueIndex("envios_proveedor_envio_id_idx")
            .on(table.proveedor_envio_id)
            .where(sql`${table.proveedor_envio_id} is not null`),
        index("envios_codigo_idx").on(table.codigo_seguimiento)
    ]
);

// Eventos de seguimiento del proveedor, deduplicados por identificador.
export const shipmentEventsTable = pgTable(
    "envio_eventos",
    {
        id: integer("id").generatedAlwaysAsIdentity().unique(),
        user: integer("user").notNull(),
        envio_id: integer("envio_id").notNull(),
        evento_proveedor_id: varchar("evento_proveedor_id", { length: 200 }).notNull(),
        estado: varchar("estado", { length: 80 }),
        status_id: varchar("status_id", { length: 80 }),
        facility: varchar("facility", { length: 160 }),
        sign: varchar("sign", { length: 160 }),
        descripcion: text("descripcion"),
        fecha_evento: timestamp("fecha_evento"),
        creado_en: timestamp("creado_en").notNull().defaultNow()
    },
    (table) => [
        primaryKey({ columns: [table.id, table.user] }),
        foreignKey({
            columns: [table.envio_id, table.user],
            foreignColumns: [shipmentsTable.id, shipmentsTable.user]
        }),
        uniqueIndex("envio_eventos_proveedor_idx").on(table.envio_id, table.evento_proveedor_id),
        index("envio_eventos_envio_fecha_idx").on(table.envio_id, table.fecha_evento)
    ]
);
