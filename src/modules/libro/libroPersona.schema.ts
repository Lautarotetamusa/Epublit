import { pgTable, integer, varchar, real, pgEnum, primaryKey } from "drizzle-orm/pg-core";
import { personasTable } from "../persona/persona.schema";
import { librosTable } from "./libro.schema";

export const libroPersonaTipoEnum = pgEnum("libro_persona_tipo", [
    "autor",
    "ilustrador"
]);

export const librosPersonasTable = pgTable(
    "libros_personas",
    {
        isbn: varchar("isbn", { length: 13 }).notNull(),
        id_persona: integer("id_persona")
            .notNull()
            .references(() => personasTable.id),
        porcentaje: real("porcentaje").default(0),
        tipo: libroPersonaTipoEnum("tipo").notNull(),
        id_libro: integer("id_libro")
            .notNull()
            .references(() => librosTable.id_libro)
    },
    (table) => [
        primaryKey({ columns: [table.id_libro, table.id_persona, table.tipo] })
    ]
);
