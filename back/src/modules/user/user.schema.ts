import { pgTable, integer, varchar, boolean, real, timestamp, uniqueIndex, index, pgEnum } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Sin `deletedAt`: no hay soft delete de usuarios hoy (bajas de cuenta no
// están en el spec), a diferencia de `personas`/`libros` que sí lo usan.
// PK simple `id`, no compuesta como `personas` (id, user): una fila de
// `users` no tiene dueño, es ella misma la entidad dueño, así que no hay
// "usuario de otro usuario" que aislar con una segunda columna en la PK.
export const usersTable = pgTable("users", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    username: varchar("username", { length: 25 }).notNull(),
    password: varchar("password", { length: 60 }).notNull(),
    cuit: varchar("cuit", { length: 15 }).notNull(),
    cond_fiscal: varchar("cond_fiscal", { length: 50 }).notNull(),
    razon_social: varchar("razon_social", { length: 255 }).notNull(),
    domicilio: varchar("domicilio", { length: 100 }).notNull(),
    production: boolean("production").notNull().default(false),
    email: varchar("email", { length: 255 }).default(""),
    ingresos_brutos: boolean("ingresos_brutos").notNull().default(false),
    fecha_inicio: varchar("fecha_inicio", { length: 10 }).notNull(),
    punto_venta: integer("punto_venta"),
    // Restricciones de foto de persona (ver specs/004-persona-foto-bio):
    // todas opcionales e independientes entre sí, `null` = "sin límite".
    foto_persona_max_size_mb: real("foto_persona_max_size_mb"),
    foto_persona_min_ancho_px: integer("foto_persona_min_ancho_px"),
    foto_persona_min_alto_px: integer("foto_persona_min_alto_px"),
    // Sólo las cuentas nuevas (`username_interno`) necesitan confirmar el
    // email para ingresar: las anteriores al registro por email quedaron
    // confirmadas por la migración (ver specs/026-registro-email).
    email_confirmado: boolean("email_confirmado").notNull().default(false),
    // Cuenta del registro por email: el username lo genera el back y no se
    // muestra. Las viejas tienen el que eligió la persona y entran con él.
    username_interno: boolean("username_interno").notNull().default(false),
    // Una cuenta nueva sin confirmar se borra 24 h después del último link,
    // no del registro: cada reenvío corre el plazo.
    confirmacion_enviada_en: timestamp("confirmacion_enviada_en", { withTimezone: true })
}, (table) => [
    // Sin distinguir mayúsculas: "Caro" y "caro" son indistinguibles para
    // una persona y una cuenta podría hacerse pasar por otra.
    uniqueIndex("users_username_lower_idx").on(sql`lower(${table.username})`),
    // Las cuentas viejas sin email (vacío o NULL) conviven entre sí.
    uniqueIndex("users_email_lower_idx")
        .on(sql`lower(${table.email})`)
        .where(sql`${table.email} IS NOT NULL AND ${table.email} <> ''`)
]);

export const tipoTokenCuentaEnum = pgEnum("tipo_token_cuenta", ["confirmar_email", "restablecer_contrasena"]);

// Links de un solo uso que se mandan por mail. Sólo se guarda el hash: con
// la base sola no se puede confirmar ni cambiar la contraseña de nadie.
export const tokensCuentaTable = pgTable("tokens_cuenta", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    // En cascada: borrar una cuenta pendiente se lleva sus links.
    user: integer("user")
        .notNull()
        .references(() => usersTable.id, { onDelete: "cascade" }),
    tipo: tipoTokenCuentaEnum("tipo").notNull(),
    hash: varchar("hash", { length: 64 }).notNull(),
    creado_en: timestamp("creado_en", { withTimezone: true }).notNull(),
    vence_en: timestamp("vence_en", { withTimezone: true }).notNull(),
    usado_en: timestamp("usado_en", { withTimezone: true })
}, (table) => [
    uniqueIndex("tokens_cuenta_hash_idx").on(table.hash),
    index("tokens_cuenta_user_idx").on(table.user, table.tipo)
]);
