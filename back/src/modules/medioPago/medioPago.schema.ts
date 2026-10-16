import { sql } from "drizzle-orm";
import { integer, pgTable, primaryKey, real, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "../user/user.schema";

// Medios de pago propios de cada cuenta (`nombre` + comisión en porcentaje).
// La comisión se congela en la venta al vender (`ventas.comision`), así que
// editar el medio no cambia el neto de las ventas ya hechas.
export const mediosPagoTable = pgTable(
    "medios_pago",
    {
        id: integer("id").generatedAlwaysAsIdentity().unique(),
        nombre: varchar("nombre", { length: 60 }).notNull(),
        comision: real("comision").notNull().default(0),
        user: integer("user")
            .notNull()
            .references(() => usersTable.id),
        // Baja lógica: un medio dado de baja no se puede usar para vender pero
        // su nombre sigue siendo resoluble en las ventas históricas.
        deletedAt: timestamp("deleted_at")
    },
    (table) => [
        // PK compuesta (id, user): bradb arma el WHERE de findOne/update/delete
        // con todas las columnas de la PK, así una cuenta nunca toca un medio
        // ajeno aunque adivine el id.
        primaryKey({ columns: [table.id, table.user] }),
        // Un nombre sólo puede repetirse entre medios activos de la misma
        // cuenta: dado de baja el anterior, el nombre queda libre otra vez.
        uniqueIndex("medios_pago_nombre_por_usuario_idx")
            .on(table.user, table.nombre)
            .where(sql`${table.deletedAt} IS NULL`)
    ]
);
