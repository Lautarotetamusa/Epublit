import { pgTable, integer, varchar, real, timestamp } from "drizzle-orm/pg-core";
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
});
