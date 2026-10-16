import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { Database } from "../../db/client";
import { movimientosTable, movimientosLibrosTable } from "../movimiento/movimiento.schema";
import { librosTable } from "../libro/libro.schema";
import { librosPersonasTable } from "../libro/libroPersona.schema";
import { personasTable } from "../persona/persona.schema";
import { rolesTable } from "../rol/rol.schema";

export type LiquidacionRepositoryDeps = {
    db: Database;
};

// Tipos de movimiento que cuentan como venta para la liquidación (plan,
// tarea 2): `devolucion`/`consignacion` quedan afuera a propósito.
const TIPOS_VENTA = ["venta", "ventaConsignacion"] as const;

export function createLiquidacionRepository({ db }: LiquidacionRepositoryDeps) {
    // Una fila por línea de venta (libro dentro de un movimiento venta/
    // ventaConsignacion) en el rango, con el precio histórico congelado en
    // `movimientos_libros` (nunca el precio actual del libro).
    const getLineasVenta = async (userId: number, desde: Date, hasta: Date) => {
        return db
            .select({
                id_libro: librosTable.id_libro,
                isbn: librosTable.isbn,
                titulo: librosTable.titulo,
                cantidad: movimientosLibrosTable.cantidad,
                precio: sql<number>`coalesce(${movimientosLibrosTable.precio}, 0)`.mapWith(Number)
            })
            .from(movimientosLibrosTable)
            .innerJoin(
                movimientosTable,
                and(
                    eq(movimientosTable.id, movimientosLibrosTable.movimiento_id),
                    eq(movimientosTable.user, movimientosLibrosTable.user)
                )
            )
            .innerJoin(
                librosTable,
                and(eq(librosTable.id_libro, movimientosLibrosTable.id_libro), eq(librosTable.user, movimientosLibrosTable.user))
            )
            .where(
                and(
                    eq(movimientosTable.user, userId),
                    inArray(movimientosTable.tipo, TIPOS_VENTA),
                    gte(movimientosTable.fecha, desde),
                    lte(movimientosTable.fecha, hasta)
                )
            );
    };

    // Personas asociadas a los libros vendidos, con el porcentaje vigente (no
    // hay historial de porcentaje en el sistema) y el rol de la cuenta con el
    // que participan de ese libro (ver specs/011-roles, tarea 13).
    const getPersonasPorLibro = async (idLibros: number[], userId: number) => {
        if (idLibros.length === 0) return [];

        return db
            .select({
                id_libro: librosPersonasTable.id_libro,
                id_persona: librosPersonasTable.id_persona,
                rol_id: rolesTable.id,
                rol_nombre: rolesTable.nombre,
                porcentaje: librosPersonasTable.porcentaje,
                nombre: personasTable.nombre
            })
            .from(librosPersonasTable)
            .innerJoin(personasTable, eq(personasTable.id, librosPersonasTable.id_persona))
            // Sin filtrar por `deleted_at`: un rol dado de baja sigue mostrando
            // su nombre en las líneas históricas que lo referencian.
            .innerJoin(rolesTable, and(eq(rolesTable.id, librosPersonasTable.id_rol), eq(rolesTable.user, userId)))
            .where(and(inArray(librosPersonasTable.id_libro, idLibros), eq(personasTable.user, userId)));
    };

    return {
        getLineasVenta,
        getPersonasPorLibro
    };
}

export type LiquidacionRepository = ReturnType<typeof createLiquidacionRepository>;
