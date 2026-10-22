import { pgTable, integer, varchar, text, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { usersTable } from "../user/user.schema";

export const coleccionesTable = pgTable(
    "colecciones",
    {
        // `.unique()` además de la PK compuesta: libros.coleccion_id referencia
        // esta columna sola, y Postgres exige unicidad para el FK (mismo caso
        // que libros.id_libro).
        id: integer("id").generatedAlwaysAsIdentity().unique(),
        titulo: varchar("titulo", { length: 60 }).notNull(),
        descripcion: text("descripcion"),
        // Key de storage (ver src/lib/storage), no la URL pública: la URL se
        // arma en el service con `storage.getUrl(portada_key)`, igual que la
        // portada de libro y la foto de persona.
        portada_key: text("portada_key"),
        user: integer("user")
            .notNull()
            .references(() => usersTable.id),
        // bradb (ServiceBuilder) detecta soft-delete por la columna `deleted_at`.
        deletedAt: timestamp("deleted_at")
    },
    (table) => [
        // PK compuesta (id, user): bradb arma el WHERE de findOne/update/delete
        // a partir de todas las columnas de la PK, así que no se puede
        // traer/editar/borrar una colección de otro usuario ni por error.
        primaryKey({ columns: [table.id, table.user] })
    ]
);
