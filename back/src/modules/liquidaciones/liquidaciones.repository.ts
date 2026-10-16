import { and, asc, count, desc, eq, gte, inArray, isNull, like, lte, sql } from "drizzle-orm";
import { NotFound } from "bradb";
import { Database, Tx } from "../../db/client";
import {
    liquidacionesTable,
    liquidacionLineasTable,
    liquidacionPagosTable,
    liquidacionPersonasTable,
    liquidacionVentasTable
} from "./liquidaciones.schema";
import { movimientosTable, movimientosLibrosTable } from "../movimiento/movimiento.schema";
import { librosTable } from "../libro/libro.schema";
import { librosPersonasTable } from "../libro/libroPersona.schema";
import { personasTable } from "../persona/persona.schema";
import { rolesTable } from "../rol/rol.schema";

export type LiquidacionesRepositoryDeps = {
    db: Database;
};

// Tipos de movimiento que cuentan como venta para la liquidación: devolucion y
// consignacion quedan afuera a propósito (mismo criterio que el reporte).
const TIPOS_VENTA = ["venta", "ventaConsignacion"] as const;

export function createLiquidacionesRepository({ db }: LiquidacionesRepositoryDeps) {
    // Una fila por línea de venta (libro dentro de un movimiento venta/
    // ventaConsignacion) en el rango, con el precio histórico congelado. El
    // LEFT JOIN contra `liquidacion_ventas` + `IS NULL` deja afuera las ventas
    // ya cubiertas por una liquidación anterior.
    const getLineasVenta = async (userId: number, desde: Date, hasta: Date) => {
        return db
            .select({
                movimiento_id: movimientosTable.id,
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
            .leftJoin(
                liquidacionVentasTable,
                and(
                    eq(liquidacionVentasTable.movimiento_id, movimientosTable.id),
                    eq(liquidacionVentasTable.user, movimientosTable.user)
                )
            )
            .where(
                and(
                    eq(movimientosTable.user, userId),
                    inArray(movimientosTable.tipo, TIPOS_VENTA),
                    gte(movimientosTable.fecha, desde),
                    lte(movimientosTable.fecha, hasta),
                    isNull(liquidacionVentasTable.movimiento_id)
                )
            );
    };

    // Personas asociadas a los libros vendidos, con el porcentaje vigente (no
    // hay historial de porcentaje en el sistema) y el rol de la cuenta.
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

    // Ventas del período ya cubiertas, agrupadas por la liquidación que las
    // cubrió: es lo que informa el reporte en `excluidas`.
    const getExcluidas = async (userId: number, desde: Date, hasta: Date) => {
        return db
            .select({
                liquidacion_id: liquidacionesTable.id,
                codigo: liquidacionesTable.codigo,
                ventas: count().mapWith(Number)
            })
            .from(liquidacionVentasTable)
            .innerJoin(
                liquidacionesTable,
                and(eq(liquidacionesTable.id, liquidacionVentasTable.liquidacion_id), eq(liquidacionesTable.user, liquidacionVentasTable.user))
            )
            .innerJoin(
                movimientosTable,
                and(eq(movimientosTable.id, liquidacionVentasTable.movimiento_id), eq(movimientosTable.user, liquidacionVentasTable.user))
            )
            .where(
                and(
                    eq(liquidacionVentasTable.user, userId),
                    gte(movimientosTable.fecha, desde),
                    lte(movimientosTable.fecha, hasta)
                )
            )
            .groupBy(liquidacionesTable.id, liquidacionesTable.codigo);
    };

    const insertLiquidacion = async (data: typeof liquidacionesTable.$inferInsert, tx?: Tx) => {
        const [row] = await (tx ?? db).insert(liquidacionesTable).values(data).returning();
        return row;
    };

    const insertPersonas = async (rows: (typeof liquidacionPersonasTable.$inferInsert)[], tx?: Tx) => {
        if (rows.length === 0) return [];
        return (tx ?? db).insert(liquidacionPersonasTable).values(rows).returning();
    };

    const insertLineas = async (rows: (typeof liquidacionLineasTable.$inferInsert)[], tx?: Tx): Promise<void> => {
        if (rows.length === 0) return;
        await (tx ?? db).insert(liquidacionLineasTable).values(rows);
    };

    const insertVentas = async (rows: (typeof liquidacionVentasTable.$inferInsert)[], tx?: Tx): Promise<void> => {
        if (rows.length === 0) return;
        await (tx ?? db).insert(liquidacionVentasTable).values(rows);
    };

    const countDelAnio = async (userId: number, anio: number): Promise<number> => {
        const [row] = await db
            .select({ cantidad: count().mapWith(Number) })
            .from(liquidacionesTable)
            .where(and(eq(liquidacionesTable.user, userId), like(liquidacionesTable.codigo, `LQ-${anio}-%`)));

        return row.cantidad;
    };

    const getLiquidaciones = async (userId: number) => {
        return db
            .select()
            .from(liquidacionesTable)
            .where(eq(liquidacionesTable.user, userId))
            .orderBy(desc(liquidacionesTable.id));
    };

    const getLiquidacionById = async (id: number, userId: number) => {
        const rows = await db
            .select()
            .from(liquidacionesTable)
            .where(and(eq(liquidacionesTable.id, id), eq(liquidacionesTable.user, userId)));

        if (rows.length === 0) throw new NotFound(`No se encontró la liquidación con id ${id}`);
        return rows[0];
    };

    const getPersonasDeLiquidacion = async (liquidacionId: number, userId: number) => {
        return db
            .select()
            .from(liquidacionPersonasTable)
            .where(and(eq(liquidacionPersonasTable.liquidacion_id, liquidacionId), eq(liquidacionPersonasTable.user, userId)))
            .orderBy(asc(liquidacionPersonasTable.id));
    };

    const getPersonasDeUsuario = async (userId: number) => {
        return db.select().from(liquidacionPersonasTable).where(eq(liquidacionPersonasTable.user, userId));
    };

    const getLineasDePersonas = async (personaIds: number[], userId: number) => {
        if (personaIds.length === 0) return [];

        return db
            .select()
            .from(liquidacionLineasTable)
            .where(and(inArray(liquidacionLineasTable.liquidacion_persona_id, personaIds), eq(liquidacionLineasTable.user, userId)))
            .orderBy(asc(liquidacionLineasTable.id));
    };

    // Pagos vigentes (no anulados): los anulados no cuentan ni se listan.
    const getPagosDeLiquidacion = async (liquidacionId: number, userId: number) => {
        return db
            .select()
            .from(liquidacionPagosTable)
            .where(
                and(
                    eq(liquidacionPagosTable.liquidacion_id, liquidacionId),
                    eq(liquidacionPagosTable.user, userId),
                    eq(liquidacionPagosTable.anulado, false)
                )
            )
            .orderBy(asc(liquidacionPagosTable.id));
    };

    const getPagosDeUsuario = async (userId: number) => {
        return db
            .select()
            .from(liquidacionPagosTable)
            .where(and(eq(liquidacionPagosTable.user, userId), eq(liquidacionPagosTable.anulado, false)));
    };

    const findPersonaDeLiquidacion = async (liquidacionId: number, idPersona: number, userId: number) => {
        const rows = await db
            .select()
            .from(liquidacionPersonasTable)
            .where(
                and(
                    eq(liquidacionPersonasTable.liquidacion_id, liquidacionId),
                    eq(liquidacionPersonasTable.id_persona, idPersona),
                    eq(liquidacionPersonasTable.user, userId)
                )
            );

        return rows[0] ?? null;
    };

    const insertPago = async (data: typeof liquidacionPagosTable.$inferInsert, tx?: Tx) => {
        const [row] = await (tx ?? db).insert(liquidacionPagosTable).values(data).returning();
        return row;
    };

    // Pago vigente de una liquidación: uno ya anulado da `null` (404 del
    // contrato de anulación).
    const getPagoVigente = async (id: number, liquidacionId: number, userId: number) => {
        const rows = await db
            .select()
            .from(liquidacionPagosTable)
            .where(
                and(
                    eq(liquidacionPagosTable.id, id),
                    eq(liquidacionPagosTable.liquidacion_id, liquidacionId),
                    eq(liquidacionPagosTable.user, userId),
                    eq(liquidacionPagosTable.anulado, false)
                )
            );

        return rows[0] ?? null;
    };

    const anularPago = async (id: number, userId: number): Promise<void> => {
        await db
            .update(liquidacionPagosTable)
            .set({ anulado: true })
            .where(and(eq(liquidacionPagosTable.id, id), eq(liquidacionPagosTable.user, userId)));
    };

    return {
        getLineasVenta,
        getPersonasPorLibro,
        getExcluidas,
        insertLiquidacion,
        insertPersonas,
        insertLineas,
        insertVentas,
        countDelAnio,
        getLiquidaciones,
        getLiquidacionById,
        getPersonasDeLiquidacion,
        getPersonasDeUsuario,
        getLineasDePersonas,
        getPagosDeLiquidacion,
        getPagosDeUsuario,
        findPersonaDeLiquidacion,
        insertPago,
        getPagoVigente,
        anularPago
    };
}

export type LiquidacionesRepository = ReturnType<typeof createLiquidacionesRepository>;
