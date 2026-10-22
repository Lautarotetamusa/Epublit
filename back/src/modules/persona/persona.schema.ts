import { pgTable, integer, varchar, text, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { usersTable } from "../user/user.schema";

export const personasTable = pgTable(
    "personas",
    {
        // `.unique()` además de la PK compuesta: libros_personas.id_persona
        // referencia esta columna sola, y Postgres exige unicidad para el FK.
        id: integer("id").generatedAlwaysAsIdentity().unique(),
        dni: varchar("dni", { length: 8 }).notNull(),
        nombre: varchar("nombre", { length: 60 }).notNull(),
        email: varchar("email", { length: 60 }).default(""),
        // Campos nuevos (ver specs/004-persona-foto-bio): opcionales, una
        // persona cargada antes de este cambio los tiene en NULL sin
        // necesidad de backfill.
        bio: text("bio"),
        // Key de storage (ver src/lib/storage), no la URL pública: la URL se
        // arma en el service con `storage.getUrl(foto_key)`, igual que
        // `libro.service.ts` con la portada.
        foto_key: text("foto_key"),
        user: integer("user")
            .notNull()
            .references(() => usersTable.id),
        deletedAt: timestamp("deleted_at")
    },
    (table) => [
        // PK compuesta (id, user): bradb arma el WHERE de findOne/update/delete
        // a partir de todas las columnas de la PK, así que esto hace que no se
        // pueda traer/editar/borrar una persona de otro usuario ni por error.
        primaryKey({ columns: [table.id, table.user] })
    ]
);
