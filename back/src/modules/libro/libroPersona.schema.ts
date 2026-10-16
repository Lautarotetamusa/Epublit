import { pgTable, integer, varchar, real, primaryKey } from "drizzle-orm/pg-core";
import { personasTable } from "../persona/persona.schema";
import { rolesTable } from "../rol/rol.schema";
import { librosTable } from "./libro.schema";

export const librosPersonasTable = pgTable(
    "libros_personas",
    {
        isbn: varchar("isbn", { length: 13 }).notNull(),
        id_persona: integer("id_persona")
            .notNull()
            .references(() => personasTable.id),
        porcentaje: real("porcentaje").default(0),
        // Rol de la cuenta con el que la persona trabaja en ese libro (ver
        // specs/011-roles): referencia al rol, no copia su nombre, así
        // renombrarlo se refleja en todas las personas que lo usan.
        id_rol: integer("id_rol")
            .notNull()
            .references(() => rolesTable.id),
        id_libro: integer("id_libro")
            .notNull()
            .references(() => librosTable.id_libro)
    },
    (table) => [
        // La terna libro + persona + rol es única: la misma persona puede tener
        // roles distintos en el mismo libro, pero no repetir el mismo rol.
        primaryKey({ columns: [table.id_libro, table.id_persona, table.id_rol] })
    ]
);
