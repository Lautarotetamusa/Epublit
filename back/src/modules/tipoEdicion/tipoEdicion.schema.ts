import { sql } from "drizzle-orm";
import { integer, pgTable, primaryKey, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "../user/user.schema";

// Tipos de edición propios de cada cuenta ("Normal", "Pop up", "Cartoné" y
// los que el usuario cree): un libro referencia el tipo de su cuenta, así
// renombrarlo se refleja en todos los libros que lo usan (mismo patrón que
// `roles`, ver specs/011-roles).
export const tiposEdicionTable = pgTable(
    "tipos_edicion",
    {
        id: integer("id").generatedAlwaysAsIdentity().unique(),
        nombre: varchar("nombre", { length: 60 }).notNull(),
        user: integer("user")
            .notNull()
            .references(() => usersTable.id),
        // Baja lógica: un tipo dado de baja no se ofrece al cargar un libro
        // pero su nombre sigue siendo resoluble en el catálogo histórico.
        deletedAt: timestamp("deleted_at")
    },
    (table) => [
        // PK compuesta (id, user): bradb arma el WHERE de findOne/update/delete
        // con todas las columnas de la PK, así una cuenta nunca toca un tipo
        // ajeno aunque adivine el id.
        primaryKey({ columns: [table.id, table.user] }),
        // Un nombre sólo puede repetirse entre tipos activos de la misma
        // cuenta, sin distinguir mayúsculas ("Normal" y "normal" no coexisten):
        // dado de baja el anterior, el nombre queda libre otra vez.
        uniqueIndex("tipos_edicion_nombre_por_usuario_idx")
            .on(table.user, sql`lower(${table.nombre})`)
            .where(sql`${table.deletedAt} IS NULL`)
    ]
);
