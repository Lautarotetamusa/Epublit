import { pgTable, integer, varchar, timestamp, primaryKey, index, pgEnum } from "drizzle-orm/pg-core";
import { usersTable } from "../user/user.schema";

export const clienteTipoEnum = pgEnum("cliente_tipo", [
    "inscripto",
    "particular",
    "negro"
]);

export const clientesTable = pgTable(
    "clientes",
    {
        // `.unique()` además de la PK compuesta: libro_cliente.id_cliente y
        // precio_libro_cliente.id_cliente referencian esta columna sola, y
        // Postgres exige unicidad para el FK.
        id: integer("id").generatedAlwaysAsIdentity().unique(),
        nombre: varchar("nombre", { length: 60 }).notNull(),
        email: varchar("email", { length: 60 }).default(""),
        cuit: varchar("cuit", { length: 15 }),
        cond_fiscal: varchar("cond_fiscal", { length: 50 }).notNull(),
        razon_social: varchar("razon_social", { length: 255 }).notNull(),
        domicilio: varchar("domicilio", { length: 100 }).notNull(),
        tipo: clienteTipoEnum("tipo"),
        user: integer("user")
            .notNull()
            .references(() => usersTable.id),
        // Alta del cliente para el panel de administración. Los existentes
        // quedan en NULL; los clientes por defecto que crea el alta de la
        // cuenta se excluyen de las operaciones en el cálculo del panel.
        created_at: timestamp("created_at").defaultNow(),
        deletedAt: timestamp("deleted_at")
    },
    (table) => [
        // PK compuesta (id, user): bradb arma el WHERE de findOne/update/delete
        // a partir de todas las columnas de la PK, así que esto hace que no se
        // pueda traer/editar/borrar un cliente de otro usuario ni por error.
        primaryKey({ columns: [table.id, table.user] }),
        // Altas por cuenta.
        index("clientes_user_created_at_idx").on(table.user, table.created_at)
    ]
);
