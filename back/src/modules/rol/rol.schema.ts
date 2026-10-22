import { sql } from "drizzle-orm";
import { integer, pgTable, primaryKey, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "../user/user.schema";

// Roles propios de cada cuenta (`autor`, `ilustrador` y los que el usuario
// cree): una relación libro↔persona referencia el rol de su cuenta, así
// renombrarlo se refleja en todas las personas que lo usan sin tocar la
// relación (ver specs/011-roles).
export const rolesTable = pgTable(
    "roles",
    {
        id: integer("id").generatedAlwaysAsIdentity().unique(),
        nombre: varchar("nombre", { length: 60 }).notNull(),
        user: integer("user")
            .notNull()
            .references(() => usersTable.id),
        // Baja lógica: un rol dado de baja no se ofrece para asignar pero su
        // nombre sigue siendo resoluble en las relaciones históricas.
        deletedAt: timestamp("deleted_at")
    },
    (table) => [
        // PK compuesta (id, user): bradb arma el WHERE de findOne/update/delete
        // con todas las columnas de la PK, así una cuenta nunca toca un rol
        // ajeno aunque adivine el id.
        primaryKey({ columns: [table.id, table.user] }),
        // Un nombre sólo puede repetirse entre roles activos de la misma
        // cuenta, sin distinguir mayúsculas (`Autor` y `autor` no coexisten):
        // dado de baja el anterior, el nombre queda libre otra vez.
        uniqueIndex("roles_nombre_por_usuario_idx")
            .on(table.user, sql`lower(${table.nombre})`)
            .where(sql`${table.deletedAt} IS NULL`)
    ]
);
