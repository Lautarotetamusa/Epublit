import { pgTable, integer, varchar, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { usersTable } from "../user/user.schema";
import { librosTable } from "./libro.schema";

// Reseña de un libro: un link a una página externa (ver
// specs/022-libro-edicion-visibilidad-resenas). Sin soft delete: no tiene
// historia que conservar.
export const libroResenasTable = pgTable(
    "libro_resenas",
    {
        id: integer("id").generatedAlwaysAsIdentity().unique(),
        id_libro: integer("id_libro")
            .notNull()
            .references(() => librosTable.id_libro, { onDelete: "cascade" }),
        url: varchar("url", { length: 500 }).notNull(),
        created_at: timestamp("created_at").notNull().defaultNow(),
        user: integer("user")
            .notNull()
            .references(() => usersTable.id)
    },
    (table) => [primaryKey({ columns: [table.id, table.user] })]
);
