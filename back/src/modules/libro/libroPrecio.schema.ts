import { pgTable, integer, varchar, real, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "../user/user.schema";
import { librosTable } from "./libro.schema";

export const precioLibrosTable = pgTable("precio_libros", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    isbn: varchar("isbn", { length: 13 }).notNull(),
    precio: real("precio").notNull(),
    created_at: timestamp("created_at").notNull().defaultNow(),
    user: integer("user")
        .notNull()
        .references(() => usersTable.id),
    id_libro: integer("id_libro")
        .notNull()
        .references(() => librosTable.id_libro)
}, (table) => [
    // Evidencia de alta de libros y cuentas (migración 0029 y panel).
    index("precio_libros_user_created_at_idx").on(table.user, table.created_at),
    index("precio_libros_libro_created_at_idx").on(table.id_libro, table.created_at)
]);
