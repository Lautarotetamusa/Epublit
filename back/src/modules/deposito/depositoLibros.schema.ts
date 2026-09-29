import { pgTable, integer, primaryKey, foreignKey } from "drizzle-orm/pg-core";
import { depositosTable } from "./deposito.schema";
import { librosTable } from "../libro/libro.schema";

// Cantidad de un libro dentro de un depósito concreto. Es la única fuente de
// stock del sistema: el total de un libro es la suma de sus filas acá (ver
// specs/008-movimientos-deposito). Las dos FKs compuestas con `user` evitan
// que una fila pueda cruzar el depósito y el libro de usuarios distintos.
// El signo de cada movimiento lo valida el service: el upsert de `moveStock`
// inserta primero con la cantidad del delta, así que un CHECK de no-negativo
// rompería las bajas sobre una fila que todavía no existía.
export const depositoLibrosTable = pgTable(
    "deposito_libros",
    {
        deposito_id: integer("deposito_id").notNull(),
        id_libro: integer("id_libro").notNull(),
        cantidad: integer("cantidad").notNull().default(0),
        user: integer("user").notNull()
    },
    (table) => [
        primaryKey({ columns: [table.deposito_id, table.id_libro] }),
        foreignKey({
            columns: [table.deposito_id, table.user],
            foreignColumns: [depositosTable.id, depositosTable.user]
        }),
        foreignKey({
            columns: [table.id_libro, table.user],
            foreignColumns: [librosTable.id_libro, librosTable.user]
        })
    ]
);
