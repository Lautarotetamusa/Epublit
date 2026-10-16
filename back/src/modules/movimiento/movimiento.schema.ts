import { pgTable, integer, varchar, timestamp, real, primaryKey, foreignKey, pgEnum, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "../user/user.schema";
import { depositosTable } from "../deposito/deposito.schema";
import { librosTable } from "../libro/libro.schema";

// El tipo de un movimiento es explícito (no se deduce del par de extremos):
// una baja y una venta comparten `depósito → exterior` y sólo se distinguen
// por este campo (ver specs/009-ledger-unificado). Conjunto cerrado en la base.
export const movimientoTipoEnum = pgEnum("movimiento_tipo", [
    "ingreso",
    "baja",
    "transferencia",
    "venta",
    "consignacion",
    "ventaConsignacion",
    "devolucion"
]);

export const extremoTipoEnum = pgEnum("extremo_tipo", ["deposito", "exterior"]);

// Un movimiento tiene un origen y un destino tipados (`deposito` o
// `exterior`). La columna `*_deposito_id` es null cuando ese extremo es el
// exterior. No hay FK borrada por baja lógica: un depósito eliminado sigue
// resolviendo su nombre desde `depositos` (ver specs/008-movimientos-deposito).
export const movimientosTable = pgTable(
    "movimientos",
    {
        id: integer("id").generatedAlwaysAsIdentity().unique(),
        fecha: timestamp("fecha").notNull().defaultNow(),
        tipo: movimientoTipoEnum("tipo").notNull(),
        origen_tipo: extremoTipoEnum("origen_tipo").notNull(),
        origen_deposito_id: integer("origen_deposito_id"),
        destino_tipo: extremoTipoEnum("destino_tipo").notNull(),
        destino_deposito_id: integer("destino_deposito_id"),
        // Key de storage del archivo emitido (factura/remito/comprobante) o
        // `null` en los movimientos manuales.
        file_path: varchar("file_path", { length: 80 }),
        user: integer("user")
            .notNull()
            .references(() => usersTable.id)
    },
    (table) => [
        primaryKey({ columns: [table.id, table.user] }),
        foreignKey({
            columns: [table.origen_deposito_id, table.user],
            foreignColumns: [depositosTable.id, depositosTable.user]
        }),
        foreignKey({
            columns: [table.destino_deposito_id, table.user],
            foreignColumns: [depositosTable.id, depositosTable.user]
        })
    ]
);

// Líneas del movimiento. El título se resuelve por join a `libros` al leer,
// así que no se duplica acá. `precio` es el unitario congelado al momento de
// la operación: sólo lo llevan los movimientos comerciales (`null` en los
// manuales).
export const movimientosLibrosTable = pgTable(
    "movimientos_libros",
    {
        movimiento_id: integer("movimiento_id").notNull(),
        id_libro: integer("id_libro").notNull(),
        cantidad: integer("cantidad").notNull(),
        precio: real("precio"),
        user: integer("user").notNull()
    },
    (table) => [
        primaryKey({ columns: [table.movimiento_id, table.id_libro] }),
        foreignKey({
            columns: [table.movimiento_id, table.user],
            foreignColumns: [movimientosTable.id, movimientosTable.user]
        }),
        foreignKey({
            columns: [table.id_libro, table.user],
            foreignColumns: [librosTable.id_libro, librosTable.user]
        }),
        check("cantidad_positiva", sql`${table.cantidad} > 0`),
        check("precio_no_negativo", sql`${table.precio} >= 0`)
    ]
);
