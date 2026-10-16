import { boolean, date, integer, pgTable, primaryKey, real, text, timestamp, uniqueIndex, varchar, foreignKey } from "drizzle-orm/pg-core";
import { usersTable } from "../user/user.schema";
import { personasTable } from "../persona/persona.schema";
import { movimientosTable } from "../movimiento/movimiento.schema";

// Liquidación persistida: antes era un reporte calculado al vuelo y ahora se
// guarda con su período, su código legible y su fecha de generación (ver
// specs/012-liquidaciones-pagos). El cálculo en sí vive en el service; acá
// sólo se modela lo que queda congelado.
export const liquidacionesTable = pgTable(
    "liquidaciones",
    {
        id: integer("id").generatedAlwaysAsIdentity().unique(),
        codigo: varchar("codigo", { length: 20 }).notNull(),
        desde: date("desde").notNull(),
        hasta: date("hasta").notNull(),
        fecha_generacion: timestamp("fecha_generacion").notNull().defaultNow(),
        user: integer("user")
            .notNull()
            .references(() => usersTable.id)
    },
    (table) => [
        // PK compuesta (id, user): bradb arma el WHERE con todas las columnas,
        // así una cuenta nunca toca una liquidación ajena aunque adivine el id.
        primaryKey({ columns: [table.id, table.user] }),
        // El código es correlativo por año y único por cuenta.
        uniqueIndex("liquidaciones_codigo_por_usuario_idx").on(table.user, table.codigo)
    ]
);

// Una persona dentro de una liquidación, con su total congelado. El nombre se
// copia (no se resuelve por join a `personas`): la ficha tiene que seguir
// mostrando la persona aunque después se dé de baja.
export const liquidacionPersonasTable = pgTable(
    "liquidacion_personas",
    {
        id: integer("id").generatedAlwaysAsIdentity().unique(),
        liquidacion_id: integer("liquidacion_id").notNull(),
        id_persona: integer("id_persona")
            .notNull()
            .references(() => personasTable.id),
        nombre: varchar("nombre", { length: 60 }).notNull(),
        total: real("total").notNull(),
        user: integer("user").notNull()
    },
    (table) => [
        primaryKey({ columns: [table.id, table.user] }),
        foreignKey({
            columns: [table.liquidacion_id, table.user],
            foreignColumns: [liquidacionesTable.id, liquidacionesTable.user]
        }),
        // A lo sumo una fila por persona dentro de una liquidación.
        uniqueIndex("liquidacion_personas_unica_idx").on(table.liquidacion_id, table.id_persona, table.user)
    ]
);

// Línea de una persona: libro + rol + porcentaje + importe congelados al
// momento de generar (mismo cálculo que el reporte, ver
// specs/012-liquidaciones-pagos, tarea 1).
export const liquidacionLineasTable = pgTable(
    "liquidacion_lineas",
    {
        id: integer("id").generatedAlwaysAsIdentity().unique(),
        liquidacion_persona_id: integer("liquidacion_persona_id").notNull(),
        id_libro: integer("id_libro").notNull(),
        titulo: varchar("titulo", { length: 60 }).notNull(),
        id_rol: integer("id_rol").notNull(),
        rol_nombre: varchar("rol_nombre", { length: 60 }).notNull(),
        porcentaje: real("porcentaje").notNull(),
        importe: real("importe").notNull(),
        user: integer("user").notNull()
    },
    (table) => [
        primaryKey({ columns: [table.id, table.user] }),
        foreignKey({
            columns: [table.liquidacion_persona_id, table.user],
            foreignColumns: [liquidacionPersonasTable.id, liquidacionPersonasTable.user]
        })
    ]
);

// Conjunto de ventas (movimientos) que cubre una liquidación. Es lo que
// garantiza que la misma venta no se liquide dos veces: la PK por
// (movimiento_id, user) hace que un movimiento sólo pueda quedar cubierto por
// una liquidación.
export const liquidacionVentasTable = pgTable(
    "liquidacion_ventas",
    {
        movimiento_id: integer("movimiento_id").notNull(),
        liquidacion_id: integer("liquidacion_id").notNull(),
        user: integer("user").notNull()
    },
    (table) => [
        primaryKey({ columns: [table.movimiento_id, table.user] }),
        foreignKey({
            columns: [table.movimiento_id, table.user],
            foreignColumns: [movimientosTable.id, movimientosTable.user]
        }),
        foreignKey({
            columns: [table.liquidacion_id, table.user],
            foreignColumns: [liquidacionesTable.id, liquidacionesTable.user]
        })
    ]
);

// Pago parcial de una persona dentro de una liquidación: monto + fecha + nota
// opcional, sin medio de pago, anulable. El estado (pendiente/parcial/pagada)
// no se guarda: se deriva de los pagos vigentes (`anulado = false`).
export const liquidacionPagosTable = pgTable(
    "liquidacion_pagos",
    {
        id: integer("id").generatedAlwaysAsIdentity().unique(),
        liquidacion_id: integer("liquidacion_id").notNull(),
        id_persona: integer("id_persona").notNull(),
        monto: real("monto").notNull(),
        fecha: date("fecha").notNull(),
        nota: text("nota"),
        anulado: boolean("anulado").notNull().default(false),
        user: integer("user").notNull()
    },
    (table) => [
        primaryKey({ columns: [table.id, table.user] }),
        foreignKey({
            columns: [table.liquidacion_id, table.user],
            foreignColumns: [liquidacionesTable.id, liquidacionesTable.user]
        })
    ]
);
