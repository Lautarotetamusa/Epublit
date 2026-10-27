import { integer, pgEnum, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "../../user/user.schema";

export const mercadoPagoStatusEnum = pgEnum("mercadopago_estado", ["conectado", "desconectado"]);

// Conexión OAuth de la cuenta con MercadoPago (ver specs/016-tienda-ecommerce).
// Los tokens se guardan cifrados y nunca se devuelven por API. Un mismo
// usuario de MercadoPago no puede quedar conectado a dos cuentas de Epublit.
export const mercadoPagoTable = pgTable(
    "mercadopago_conexiones",
    {
        id: integer("id").generatedAlwaysAsIdentity().unique(),
        user: integer("user")
            .notNull()
            .references(() => usersTable.id),
        mp_user_id: varchar("mp_user_id", { length: 64 }).notNull(),
        alias: varchar("alias", { length: 120 }),
        email: varchar("email", { length: 255 }),
        aplicacion_id: varchar("aplicacion_id", { length: 64 }),
        access_token_cifrado: text("access_token_cifrado").notNull(),
        refresh_token_cifrado: text("refresh_token_cifrado"),
        vencimiento: timestamp("vencimiento"),
        estado: mercadoPagoStatusEnum("estado").notNull().default("conectado"),
        conectado_en: timestamp("conectado_en").notNull().defaultNow(),
        actualizado_en: timestamp("actualizado_en").notNull().defaultNow()
    },
    (table) => [
        // Una conexión por cuenta.
        uniqueIndex("mercadopago_conexiones_user_idx").on(table.user),
        // Un usuario de MercadoPago sólo puede estar conectado a una cuenta.
        uniqueIndex("mercadopago_conexiones_mp_user_conectado_idx")
            .on(table.mp_user_id)
            .where(sql`${table.estado} = 'conectado'`)
    ]
);
