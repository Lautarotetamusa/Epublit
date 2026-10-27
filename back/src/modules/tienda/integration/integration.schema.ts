import { boolean, index, integer, pgTable, primaryKey, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "../../user/user.schema";

// Integración de la tienda del comprador con la API pública (ver
// specs/016-tienda-ecommerce): cada una tiene su propia API key, su origen
// permitido y se puede desactivar o revoke. La clave completa se muestra una
// sola vez; acá sólo queda el hash y un prefijo visible.
export const integrationsTable = pgTable(
    "integraciones",
    {
        id: integer("id").generatedAlwaysAsIdentity().unique(),
        user: integer("user")
            .notNull()
            .references(() => usersTable.id),
        nombre: varchar("nombre", { length: 120 }).notNull(),
        // Origen normalizado (`scheme://host[:port]`), sin path/query/fragmento.
        origen: varchar("origen", { length: 255 }).notNull(),
        prefijo: varchar("prefijo", { length: 16 }).notNull(),
        clave_hash: varchar("clave_hash", { length: 64 }).notNull(),
        activa: boolean("activa").notNull().default(true),
        revocada: boolean("revocada").notNull().default(false),
        ultimo_uso: timestamp("ultimo_uso"),
        creada_en: timestamp("creada_en").notNull().defaultNow(),
        actualizada_en: timestamp("actualizada_en").notNull().defaultNow(),
        revocada_en: timestamp("revocada_en")
    },
    (table) => [
        primaryKey({ columns: [table.id, table.user] }),
        // El hash identifica la integración sin guardar la clave en claro: es
        // único en toda la base porque la búsqueda de auth es sólo por hash.
        uniqueIndex("integraciones_clave_hash_idx").on(table.clave_hash),
        index("integraciones_user_prefijo_idx").on(table.user, table.prefijo),
        index("integraciones_user_idx").on(table.user)
    ]
);
