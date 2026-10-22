import { boolean, date, integer, pgTable, primaryKey, real, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "../user/user.schema";
import { librosTable } from "../libro/libro.schema";
import { personasTable } from "../persona/persona.schema";
import { rolesTable } from "../rol/rol.schema";

// Anticipo que cobra una persona por un rol al lanzarse un libro (ver
// specs/012-liquidaciones-pagos). El monto es un snapshot del monto acordado
// en `libros_personas` al generarse: editarlo después no cambia el anticipo.
// Pago único (pagado / pendiente), sin parciales ni saldo. Está separado de
// las regalías: no se descuenta ni se recupera en ninguna liquidación.
export const anticiposTable = pgTable(
    "anticipos",
    {
        id: integer("id").generatedAlwaysAsIdentity().unique(),
        id_libro: integer("id_libro")
            .notNull()
            .references(() => librosTable.id_libro),
        id_persona: integer("id_persona")
            .notNull()
            .references(() => personasTable.id),
        id_rol: integer("id_rol")
            .notNull()
            .references(() => rolesTable.id),
        monto: real("monto").notNull(),
        fecha_lanzamiento: date("fecha_lanzamiento").notNull(),
        pagado: boolean("pagado").notNull().default(false),
        fecha_pago: date("fecha_pago"),
        user: integer("user")
            .notNull()
            .references(() => usersTable.id)
    },
    (table) => [
        // PK compuesta (id, user): ownership implícito en findOne/update.
        primaryKey({ columns: [table.id, table.user] }),
        // A lo sumo un anticipo por libro + persona + rol de la cuenta: es la
        // garantía de que una reimpresión no multiplica el anticipo.
        uniqueIndex("anticipos_libro_persona_rol_idx").on(table.id_libro, table.id_persona, table.id_rol, table.user)
    ]
);
