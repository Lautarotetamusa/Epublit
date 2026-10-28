import {
    check,
    foreignKey,
    index,
    integer,
    pgEnum,
    pgTable,
    primaryKey,
    real,
    text,
    timestamp,
    uniqueIndex,
    varchar
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "../../user/user.schema";
import { integrationsTable } from "../integration/integration.schema";
import { movimientosTable } from "../../movimiento/movimiento.schema";
import { comprobantesTable } from "../../comprobante/comprobante.schema";

export const orderStatusEnum = pgEnum("pedido_estado", [
    "pendiente_pago",
    "pagado",
    "aceptado",
    "rechazado",
    "enviado",
    "entregado",
    "cancelado"
]);

export const orderPaymentStatusEnum = pgEnum("pedido_pago_estado", [
    "pendiente",
    "aprobado",
    "rechazado",
    "reembolsado"
]);

export const orderDeliveryTypeEnum = pgEnum("pedido_entrega_tipo", ["envio", "retiro"]);

// Pedido de la tienda pública (ver specs/016-tienda-ecommerce). Guarda el
// snapshot del comprador y de la entrega: el comprador es invitado y no hay
// una cuenta reutilizable. Los importes y el peso quedan congelados.
export const ordersTable = pgTable(
    "pedidos",
    {
        id: integer("id").generatedAlwaysAsIdentity().unique(),
        user: integer("user")
            .notNull()
            .references(() => usersTable.id),
        integracion_id: integer("integracion_id").notNull(),
        // Correlativo legible por cuenta (`PED-2026-000001`).
        codigo: varchar("codigo", { length: 30 }).notNull(),
        // Referencia estable enviada a MercadoPago para asociar el pago.
        referencia_externa: varchar("referencia_externa", { length: 120 }).notNull(),
        // Única por integración: la misma clave en otra integración es otro
        // pedido (ver criterio de idempotencia del plan).
        clave_idempotencia: varchar("clave_idempotencia", { length: 200 }).notNull(),
        // Hash canónico del body: distingue replay del mismo checkout de un
        // conflicto con otro cuerpo bajo la misma clave.
        hash_idempotencia: varchar("hash_idempotencia", { length: 64 }),
        comprador_nombre: varchar("comprador_nombre", { length: 160 }).notNull(),
        comprador_email: varchar("comprador_email", { length: 255 }).notNull(),
        comprador_telefono: varchar("comprador_telefono", { length: 40 }),
        comprador_documento: varchar("comprador_documento", { length: 40 }),
        entrega_tipo: orderDeliveryTypeEnum("entrega_tipo").notNull(),
        entrega_calle: varchar("entrega_calle", { length: 160 }),
        entrega_numero: varchar("entrega_numero", { length: 20 }),
        entrega_piso: varchar("entrega_piso", { length: 20 }),
        entrega_depto: varchar("entrega_depto", { length: 20 }),
        entrega_localidad: varchar("entrega_localidad", { length: 120 }),
        entrega_provincia: varchar("entrega_provincia", { length: 120 }),
        entrega_codigo_postal: varchar("entrega_codigo_postal", { length: 12 }),
        retiro_direccion: text("retiro_direccion"),
        retiro_horario: text("retiro_horario"),
        // Peso y caja usados para cotizar/generar la etiqueta, congelados al
        // crear el pedido.
        peso_kg: real("peso_kg"),
        caja_alto_cm: real("caja_alto_cm"),
        caja_ancho_cm: real("caja_ancho_cm"),
        caja_largo_cm: real("caja_largo_cm"),
        // URL de retorno del checkout, necesaria para regenerar preferencias.
        url_retorno: varchar("url_retorno", { length: 500 }),
        estado: orderStatusEnum("estado").notNull().default("pendiente_pago"),
        estado_pago: orderPaymentStatusEnum("estado_pago").notNull().default("pendiente"),
        moneda: varchar("moneda", { length: 3 }).notNull().default("ARS"),
        subtotal: real("subtotal").notNull(),
        costo_envio: real("costo_envio").notNull().default(0),
        total: real("total").notNull(),
        motivo_rechazo: text("motivo_rechazo"),
        detalle_rechazo: text("detalle_rechazo"),
        venta_id: integer("venta_id"),
        // Comprobante fiscal del pedido (ver specs/017-comprobantes-afip).
        // Las columnas `comprobante_*` de abajo quedan como snapshot histórico
        // sin uso: no se escriben ni se leen en el flujo nuevo.
        comprobante_id: integer("comprobante_id"),
        comprobante_tipo: varchar("comprobante_tipo", { length: 2 }),
        comprobante_numero: varchar("comprobante_numero", { length: 30 }),
        comprobante_fecha: timestamp("comprobante_fecha"),
        comprobante_file_path: text("comprobante_file_path"),
        comprobante_estado: varchar("comprobante_estado", { length: 20 }).notNull().default("pendiente"),
        creado_en: timestamp("creado_en").notNull().defaultNow(),
        actualizado_en: timestamp("actualizado_en").notNull().defaultNow()
    },
    (table) => [
        primaryKey({ columns: [table.id, table.user] }),
        foreignKey({
            columns: [table.integracion_id, table.user],
            foreignColumns: [integrationsTable.id, integrationsTable.user]
        }),
        foreignKey({
            columns: [table.venta_id, table.user],
            foreignColumns: [movimientosTable.id, movimientosTable.user]
        }),
        foreignKey({
            columns: [table.comprobante_id, table.user],
            foreignColumns: [comprobantesTable.id, comprobantesTable.user]
        }),
        uniqueIndex("pedidos_codigo_por_cuenta_idx").on(table.user, table.codigo),
        // Un comprobante no puede estar asociado a dos pedidos.
        uniqueIndex("pedidos_comprobante_idx")
            .on(table.comprobante_id)
            .where(sql`${table.comprobante_id} is not null`),
        // La referencia externa se usa para buscar el pedido desde el webhook.
        uniqueIndex("pedidos_referencia_externa_idx").on(table.referencia_externa),
        uniqueIndex("pedidos_idempotencia_integracion_idx").on(table.integracion_id, table.clave_idempotencia),
        index("pedidos_user_fecha_idx").on(table.user, table.creado_en),
        index("pedidos_user_estado_idx").on(table.user, table.estado),
        index("pedidos_user_entrega_idx").on(table.user, table.entrega_tipo),
        check("pedidos_subtotal_no_negativo", sql`${table.subtotal} >= 0`),
        check("pedidos_costo_envio_no_negativo", sql`${table.costo_envio} >= 0`),
        check("pedidos_total_no_negativo", sql`${table.total} >= 0`)
    ]
);
