import { pgTable, integer, varchar, boolean } from "drizzle-orm/pg-core";

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
    production: boolean("production").default(false),
    email: varchar("email", { length: 255 }).default(""),
    ingresos_brutos: boolean("ingresos_brutos").notNull().default(false),
    fecha_inicio: varchar("fecha_inicio", { length: 10 }).notNull(),
    punto_venta: integer("punto_venta")
});
