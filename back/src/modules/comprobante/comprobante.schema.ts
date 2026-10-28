import {
    check,
    date,
    foreignKey,
    index,
    integer,
    jsonb,
    numeric,
    pgEnum,
    pgTable,
    primaryKey,
    text,
    timestamp,
    uniqueIndex,
    varchar
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "../user/user.schema";
import { movimientosTable } from "../movimiento/movimiento.schema";

// El tipo es granular (incluye la letra AFIP) para que la numeración sea única
// por tipo/punto de venta y no haya columnas nullable de letra/código. El
// remito comparte la tabla base pero no tiene extensión fiscal.
export const comprobanteTipoEnum = pgEnum("comprobante_tipo", [
    "factura_a",
    "factura_b",
    "factura_c",
    "factura_m",
    "remito"
]);

export const comprobanteEstadoEnum = pgEnum("comprobante_estado", [
    "pendiente",
    "emitida",
    "error"
]);

export const facturaResultadoEnum = pgEnum("factura_resultado", ["A", "R"]);

export type ComprobanteTipo = (typeof comprobanteTipoEnum.enumValues)[number];
export type ComprobanteEstado = (typeof comprobanteEstadoEnum.enumValues)[number];
export type FacturaResultado = (typeof facturaResultadoEnum.enumValues)[number];

export const CODIGO_AFIP_POR_TIPO = {
    factura_a: 1,
    factura_b: 6,
    factura_c: 11,
    factura_m: 51
} as const satisfies Record<Exclude<ComprobanteTipo, "remito">, number>;

export type ComprobanteTipoFactura = keyof typeof CODIGO_AFIP_POR_TIPO;

export const TIPO_POR_CODIGO_AFIP: Record<number, ComprobanteTipoFactura> = {
    1: "factura_a",
    6: "factura_b",
    11: "factura_c",
    51: "factura_m"
};

// Snapshot inmutable al momento de crear el comprobante: cambiar después la
// cuenta o el cliente no puede alterar una factura ya autorizada por AFIP.
export type ComprobanteEmisorSnapshot = {
    razonSocial: string;
    cuit: string;
    condicionFiscal: string;
    domicilio: string;
    ingresosBrutos: string | null;
    inicioActividades: string;
    email: string | null;
    logoUrl: string | null;
};

export type ComprobanteReceptorSnapshot = {
    razonSocial: string;
    cuit: string | null;
    documento: string | null;
    condicionFiscal: string;
    domicilio: string;
    condicionVenta: string | null;
};

export type ComprobanteItemSnapshot = {
    isbn: string | null;
    titulo: string;
    autor: string | null;
    cantidad: number;
    precioUnitario: number;
    descuentoPorcentaje: number;
    importeDescuento: number;
    subtotal: number;
};

export const comprobantesTable = pgTable(
    "comprobantes",
    {
        id: integer("id").generatedAlwaysAsIdentity().unique(),
        // Dueño del comprobante (multi-tenant). No es `emisor_id`: los datos
        // fiscales del emisor viven en el snapshot `emisor`.
        user: integer("user")
            .notNull()
            .references(() => usersTable.id),
        tipo: comprobanteTipoEnum("tipo").notNull(),
        movimiento_id: integer("movimiento_id").notNull(),
        punto_venta: integer("punto_venta").notNull(),
        numero: integer("numero"),
        fecha: date("fecha"),
        estado: comprobanteEstadoEnum("estado").notNull().default("pendiente"),
        moneda: varchar("moneda", { length: 3 }).notNull().default("ARS"),
        importe_subtotal: numeric("importe_subtotal", { precision: 14, scale: 2, mode: "number" })
            .notNull()
            .default(0),
        importe_total: numeric("importe_total", { precision: 14, scale: 2, mode: "number" })
            .notNull()
            .default(0),
        emisor: jsonb("emisor").$type<ComprobanteEmisorSnapshot>().notNull(),
        receptor: jsonb("receptor").$type<ComprobanteReceptorSnapshot>().notNull(),
        items: jsonb("items").$type<ComprobanteItemSnapshot[]>().notNull().default(sql`'[]'::jsonb`),
        plantilla_version: integer("plantilla_version").notNull().default(1),
        creado_en: timestamp("creado_en").notNull().defaultNow(),
        actualizado_en: timestamp("actualizado_en").notNull().defaultNow()
    },
    (table) => [
        primaryKey({ columns: [table.id, table.user] }),
        foreignKey({
            columns: [table.movimiento_id, table.user],
            foreignColumns: [movimientosTable.id, movimientosTable.user]
        }),
        // Un movimiento tiene un único comprobante: es la garantía de
        // idempotencia de todo el flujo de emisión.
        uniqueIndex("comprobantes_movimiento_por_cuenta_idx").on(table.user, table.movimiento_id),
        uniqueIndex("comprobantes_numeracion_idx")
            .on(table.user, table.tipo, table.punto_venta, table.numero)
            .where(sql`${table.numero} is not null`),
        index("comprobantes_user_estado_idx").on(table.user, table.estado),
        index("comprobantes_user_fecha_idx").on(table.user, table.fecha),
        index("comprobantes_user_tipo_idx").on(table.user, table.tipo),
        check("comprobantes_importe_subtotal_no_negativo", sql`${table.importe_subtotal} >= 0`),
        check("comprobantes_importe_total_no_negativo", sql`${table.importe_total} >= 0`),
        check("comprobantes_punto_venta_positivo", sql`${table.punto_venta} > 0`),
        check("comprobantes_numero_positivo", sql`${table.numero} is null or ${table.numero} > 0`),
        check(
            "comprobantes_emitida_con_numero",
            sql`${table.estado} <> 'emitida' or ${table.numero} is not null`
        )
    ]
);

// Extensión 1:1 de `comprobantes` con lo específico de AFIP. Los remitos no
// tienen fila acá.
export const facturasTable = pgTable(
    "facturas",
    {
        comprobante_id: integer("comprobante_id")
            .primaryKey()
            .references(() => comprobantesTable.id),
        codigo_afip: integer("codigo_afip").notNull(),
        cae: varchar("cae", { length: 20 }),
        cae_vencimiento: date("cae_vencimiento"),
        resultado: facturaResultadoEnum("resultado"),
        observaciones: jsonb("observaciones").$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),
        // Request/response crudo de AFIP: auditoría interna, nunca se expone.
        datos_afip: jsonb("datos_afip").$type<Record<string, unknown>>(),
        qr_url: text("qr_url"),
        // Número que se intentó emitir antes de llamar a AFIP. Permite
        // reconciliar un timeout consultando `getVoucherInfo` en vez de pedir
        // un número nuevo a ciegas.
        numero_esperado: integer("numero_esperado"),
        importe_envio: numeric("importe_envio", { precision: 14, scale: 2, mode: "number" })
            .notNull()
            .default(0),
        importe_descuento: numeric("importe_descuento", { precision: 14, scale: 2, mode: "number" })
            .notNull()
            .default(0),
        importe_neto: numeric("importe_neto", { precision: 14, scale: 2, mode: "number" })
            .notNull()
            .default(0),
        importe_iva: numeric("importe_iva", { precision: 14, scale: 2, mode: "number" })
            .notNull()
            .default(0),
        importe_exento: numeric("importe_exento", { precision: 14, scale: 2, mode: "number" })
            .notNull()
            .default(0),
        importe_no_gravado: numeric("importe_no_gravado", { precision: 14, scale: 2, mode: "number" })
            .notNull()
            .default(0),
        importe_tributos: numeric("importe_tributos", { precision: 14, scale: 2, mode: "number" })
            .notNull()
            .default(0),
        descuento_porcentaje: numeric("descuento_porcentaje", {
            precision: 5,
            scale: 2,
            mode: "number"
        })
            .notNull()
            .default(0),
        error_codigo: varchar("error_codigo", { length: 40 }),
        error_mensaje: text("error_mensaje"),
        intentos: integer("intentos").notNull().default(0),
        // Claim de emisión: si quedó colgado de un proceso muerto vence a los
        // 5 minutos y habilita el reintento.
        procesando_desde: timestamp("procesando_desde"),
        ultimo_intento_en: timestamp("ultimo_intento_en"),
        emitido_en: timestamp("emitido_en")
    },
    (table) => [
        check(
            "facturas_codigo_afip_valido",
            sql`${table.codigo_afip} in (1, 6, 11, 51)`
        ),
        check("facturas_importe_envio_no_negativo", sql`${table.importe_envio} >= 0`),
        check("facturas_importe_descuento_no_negativo", sql`${table.importe_descuento} >= 0`),
        check("facturas_importe_neto_no_negativo", sql`${table.importe_neto} >= 0`),
        check("facturas_importe_iva_no_negativo", sql`${table.importe_iva} >= 0`),
        check("facturas_importe_exento_no_negativo", sql`${table.importe_exento} >= 0`),
        check("facturas_importe_no_gravado_no_negativo", sql`${table.importe_no_gravado} >= 0`),
        check("facturas_importe_tributos_no_negativo", sql`${table.importe_tributos} >= 0`),
        check(
            "facturas_descuento_porcentaje_valido",
            sql`${table.descuento_porcentaje} >= 0 and ${table.descuento_porcentaje} <= 100`
        )
    ]
);
