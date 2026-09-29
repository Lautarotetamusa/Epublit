import { pgTable, integer, varchar, text, boolean, timestamp, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "../user/user.schema";

export const depositosTable = pgTable(
    "depositos",
    {
        id: integer("id").generatedAlwaysAsIdentity().unique(),
        nombre: varchar("nombre", { length: 60 }).notNull(),
        descripcion: text("descripcion"),
        // El principal se crea solo con el usuario y no se puede editar ni
        // borrar (ver specs/008-movimientos-deposito). Se marca con este flag.
        principal: boolean("principal").notNull().default(false),
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
            .where(sql`${table.principal} AND ${table.deletedAt} IS NULL`)
    ]
);
