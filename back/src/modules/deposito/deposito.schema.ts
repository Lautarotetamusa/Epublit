import { pgTable, integer, varchar, text, boolean, timestamp, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "../user/user.schema";
import { clientesTable } from "../cliente/cliente.schema";

export const depositosTable = pgTable(
    "depositos",
    {
        id: integer("id").generatedAlwaysAsIdentity().unique(),
        nombre: varchar("nombre", { length: 60 }).notNull(),
        descripcion: text("descripcion"),
        // El principal se crea solo con el usuario y no se puede editar ni
        // borrar (ver specs/008-movimientos-deposito). Se marca con este flag.
        principal: boolean("principal").notNull().default(false),
        // Depósito propio de un cliente (stock consignado, ver
        // specs/009-ledger-unificado): `null` en los depósitos del usuario.
        // Queda fuera del listado/administración de `/deposito` y su stock
        // sólo se mueve por movimientos.
        id_cliente: integer("id_cliente").references(() => clientesTable.id),
        user: integer("user")
            .notNull()
            .references(() => usersTable.id),
        // Baja lógica: un depósito borrado deja de aparecer en la API pero su
        // nombre sigue siendo resoluble en los movimientos históricos.
        deletedAt: timestamp("deleted_at")
    },
    (table) => [
        // PK compuesta (id, user): bradb y los joins pueden scopear por dueño
        // sin confiar sólo en el filtro del service.
        primaryKey({ columns: [table.id, table.user] }),
        // A lo sumo un principal vigente por usuario.
        uniqueIndex("depositos_principal_por_usuario_idx")
            .on(table.user)
            .where(sql`${table.principal} AND ${table.deletedAt} IS NULL`),
        // A lo sumo un depósito propio por cliente.
        uniqueIndex("depositos_cliente_idx")
            .on(table.id_cliente)
            .where(sql`${table.id_cliente} IS NOT NULL`)
    ]
);
