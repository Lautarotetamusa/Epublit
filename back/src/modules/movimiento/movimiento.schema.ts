import { pgTable, integer, varchar, timestamp, primaryKey, foreignKey } from "drizzle-orm/pg-core";
import { usersTable } from "../user/user.schema";
import { depositosTable } from "../deposito/deposito.schema";
import { librosTable } from "../libro/libro.schema";

// Un movimiento tiene un origen y un destino tipados (`deposito` o
// `exterior`). La columna `*_deposito_id` es null cuando ese extremo es el
// exterior. No hay FK borrada por baja lógica: un depósito eliminado sigue
// resolviendo su nombre desde `depositos` (ver specs/008-movimientos-deposito).
export const movimientosTable = pgTable(
    "movimientos",
    {
        id: integer("id").generatedAlwaysAsIdentity().unique(),
        fecha: timestamp("fecha").notNull().defaultNow(),
        origen_tipo: varchar("origen_tipo", { length: 10 }).notNull(),
        origen_deposito_id: integer("origen_deposito_id"),
        destino_tipo: varchar("destino_tipo", { length: 10 }).notNull(),
        destino_deposito_id: integer("destino_deposito_id"),
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
// así que no se duplica acá.
export const movimientosLibrosTable = pgTable(
    "movimientos_libros",
    {
        movimiento_id: integer("movimiento_id").notNull(),
        id_libro: integer("id_libro").notNull(),
        cantidad: integer("cantidad").notNull(),
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
        })
    ]
);
