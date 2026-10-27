import { boolean, check, integer, pgTable, real, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "../../user/user.schema";

// Configuración de envíos y retiro por cuenta (ver specs/016-tienda-ecommerce).
// Una sola fila por cuenta; la credencial de MiCorreo se guarda cifrada y no se
// devuelve por API.
export const shippingConfigTable = pgTable(
    "envio_config",
    {
        id: integer("id").generatedAlwaysAsIdentity().unique(),
        user: integer("user")
            .notNull()
            .references(() => usersTable.id),
        micorreo_usuario: varchar("micorreo_usuario", { length: 120 }),
        // Password de MiCorreo cifrada con `CREDENTIALS_ENCRYPTION_KEY`.
        micorreo_credencial_cifrada: text("micorreo_credencial_cifrada"),
        micorreo_customer_id: varchar("micorreo_customer_id", { length: 60 }),
        // PAQ.AR API 2.0: alta/etiqueta/tracking en fase 3; acá se guarda y prueba.
        paqar_agreement: varchar("paqar_agreement", { length: 120 }),
        paqar_api_key_cifrada: text("paqar_api_key_cifrada"),
        paqar_seller_id: varchar("paqar_seller_id", { length: 120 }),
        // Fallback para libros sin peso propio.
        peso_promedio_kg: real("peso_promedio_kg"),
        origen_calle: varchar("origen_calle", { length: 120 }),
        origen_numero: varchar("origen_numero", { length: 20 }),
        origen_piso: varchar("origen_piso", { length: 20 }),
        origen_depto: varchar("origen_depto", { length: 20 }),
        origen_localidad: varchar("origen_localidad", { length: 120 }),
        origen_provincia: varchar("origen_provincia", { length: 120 }),
        origen_codigo_postal: varchar("origen_codigo_postal", { length: 12 }),
        caja_alto_cm: real("caja_alto_cm").notNull().default(10),
        caja_ancho_cm: real("caja_ancho_cm").notNull().default(10),
        caja_largo_cm: real("caja_largo_cm").notNull().default(10),
        formato_etiqueta: varchar("formato_etiqueta", { length: 10 }).notNull().default("10x15"),
        retiro_activo: boolean("retiro_activo").notNull().default(false),
        retiro_direccion: text("retiro_direccion"),
        retiro_horario: text("retiro_horario"),
        creada_en: timestamp("creada_en").notNull().defaultNow(),
        actualizada_en: timestamp("actualizada_en").notNull().defaultNow()
    },
    (table) => [
        uniqueIndex("envio_config_user_idx").on(table.user),
        check("envio_config_peso_promedio_positivo", sql`${table.peso_promedio_kg} is null or ${table.peso_promedio_kg} > 0`),
        check("envio_config_caja_positiva", sql`${table.caja_alto_cm} > 0 and ${table.caja_ancho_cm} > 0 and ${table.caja_largo_cm} > 0`)
    ]
);
