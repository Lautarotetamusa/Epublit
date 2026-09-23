import { pgTable, integer, varchar, date, real, timestamp, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./users.schema";

export const librosTable = pgTable(
    "libros",
    {
        // `.unique()` además de la PK compuesta: precio_libros.id_libro,
        // libros_personas.id_libro y libro_cliente.id_libro referencian esta
        // columna sola, y Postgres exige unicidad para el FK.
        id_libro: integer("id_libro").generatedAlwaysAsIdentity().unique(),
        isbn: varchar("isbn", { length: 13 }).notNull(),
        titulo: varchar("titulo", { length: 60 }).notNull(),
        fecha_edicion: date("fecha_edicion").notNull(),
        precio: real("precio").notNull(),
        stock: integer("stock").default(0),
        // bradb (ServiceBuilder) detecta soft-delete por la columna `deleted_at`.
        deletedAt: timestamp("deleted_at"),
        user: integer("user")
            .notNull()
            .references(() => usersTable.id)
    },
    (table) => [
        // PK compuesta (id_libro, user): bradb arma el WHERE de
        // findOne/update/delete a partir de todas las columnas de la PK, así
        // que esto hace que no se pueda traer/editar/borrar un libro de otro
        // usuario ni por error.
        primaryKey({ columns: [table.id_libro, table.user] }),
        // isbn como valor único por usuario, sólo entre libros activos: un
        // isbn eliminado puede reutilizarse (ver spec, "Casos borde").
        uniqueIndex("libros_isbn_user_active_idx")
            .on(table.isbn, table.user)
            .where(sql`deleted_at IS NULL`)
    ]
);
