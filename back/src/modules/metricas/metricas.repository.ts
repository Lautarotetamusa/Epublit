import { and, asc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import { Database } from "../../db/client";
import { movimientosTable, movimientosLibrosTable } from "../movimiento/movimiento.schema";
import { ventasTable } from "../transaccion/venta.schema";
import { clientesTable } from "../cliente/cliente.schema";
import { depositosTable } from "../deposito/deposito.schema";
import { mediosPagoTable } from "../medioPago/medioPago.schema";
import { librosTable } from "../libro/libro.schema";
import { ZONA_HORARIA } from "./metricas.periodo";

export type MetricasRepositoryDeps = {
    db: Database;
};

export type TipoVenta = "venta" | "ventaConsignacion";

export type VentaDelPeriodo = {
    movimiento_id: number;
    total: number;
    id_cliente: number;
    cliente: string;
    id_deposito: number | null;
    deposito: string | null;
    deposito_es_cliente: boolean;
    // Cliente dueño del depósito de origen cuando es un depósito consignado
    // (stock de un cliente): el clic de esa fila abre su ficha.
    id_cliente_deposito: number | null;
};

export type LineaDelPeriodo = {
    movimiento_id: number;
    id_libro: number;
    isbn: string;
    titulo: string;
    cantidad: number;
    precio: number;
};

// Mes calendario en hora local de Argentina. `fecha` es `timestamp` sin zona y
// se guarda en UTC (session TimeZone = UTC), así que primero se le declara la
// zona UTC y recién después se convierte a la de la editorial.
const ZONA_SQL = `'${ZONA_HORARIA}'`;
const mesLocal = () =>
    sql<string>`to_char((${movimientosTable.fecha} AT TIME ZONE 'UTC') AT TIME ZONE ${sql.raw(ZONA_SQL)}, 'YYYY-MM')`;

const filtroVentas = (userId: number, tipos: TipoVenta[], desde: Date, hasta: Date) =>
    and(
        eq(movimientosTable.user, userId),
        inArray(movimientosTable.tipo, tipos),
        gte(movimientosTable.fecha, desde),
        lte(movimientosTable.fecha, hasta)
    );

export function createMetricasRepository({ db }: MetricasRepositoryDeps) {
    // Una fila por venta del período, con cliente, medio de pago y depósito de
    // origen ya resueltos. El depósito de origen es el que hace el corte por
    // depósito: el principal en una venta en firme, el del cliente en una venta
    // sobre consignación.
    const getVentas = async (userId: number, tipos: TipoVenta[], desde: Date, hasta: Date): Promise<VentaDelPeriodo[]> => {
        return db
            .select({
                movimiento_id: ventasTable.id_movimiento,
                total: ventasTable.total,
                id_cliente: ventasTable.id_cliente,
                cliente: clientesTable.nombre,
                id_deposito: depositosTable.id,
                deposito: depositosTable.nombre,
                deposito_es_cliente: sql<boolean>`(${depositosTable.id_cliente} IS NOT NULL)`,
                id_cliente_deposito: depositosTable.id_cliente
            })
            .from(ventasTable)
            .innerJoin(
                movimientosTable,
                and(eq(movimientosTable.id, ventasTable.id_movimiento), eq(movimientosTable.user, userId))
            )
            .innerJoin(clientesTable, and(eq(clientesTable.id, ventasTable.id_cliente), eq(clientesTable.user, userId)))
            .leftJoin(
                depositosTable,
                and(eq(depositosTable.id, movimientosTable.origen_deposito_id), eq(depositosTable.user, userId))
            )
            .where(filtroVentas(userId, tipos, desde, hasta));
    };

    // Una fila por línea de las ventas del período (mismo filtro que
    // `getVentas`): es la que aporta ejemplares y el importe de línea para
    // repartir el total de cada venta.
    const getLineas = async (userId: number, tipos: TipoVenta[], desde: Date, hasta: Date): Promise<LineaDelPeriodo[]> => {
        return db
            .select({
                movimiento_id: movimientosLibrosTable.movimiento_id,
                id_libro: movimientosLibrosTable.id_libro,
                isbn: librosTable.isbn,
                titulo: librosTable.titulo,
                cantidad: movimientosLibrosTable.cantidad,
                precio: sql<number>`coalesce(${movimientosLibrosTable.precio}, 0)`.mapWith(Number)
            })
            .from(movimientosLibrosTable)
            .innerJoin(
                movimientosTable,
                and(eq(movimientosTable.id, movimientosLibrosTable.movimiento_id), eq(movimientosTable.user, userId))
            )
            .innerJoin(
                librosTable,
                and(eq(librosTable.id_libro, movimientosLibrosTable.id_libro), eq(librosTable.user, userId))
            )
            .where(filtroVentas(userId, tipos, desde, hasta));
    };

    // Los meses con ventas (de cualquier tipo) o con un ingreso de stock real
    // (los de la migración no cuentan como movimiento del panel).
    const getMeses = async (userId: number): Promise<string[]> => {
        const filas = await db
            .selectDistinct({ mes: mesLocal() })
            .from(movimientosTable)
            .where(
                and(
                    eq(movimientosTable.user, userId),
                    or(
                        inArray(movimientosTable.tipo, ["venta", "ventaConsignacion"]),
                        and(eq(movimientosTable.tipo, "ingreso"), eq(movimientosTable.es_migracion, false))
                    )
                )
            );

        return filas.map((fila) => fila.mes);
    };

    const getIngresoPorMes = async (userId: number, tipos: TipoVenta[], desde: Date, hasta: Date) => {
        return db
            .select({
                mes: mesLocal(),
                ingreso: sql<number>`coalesce(sum(${ventasTable.total}), 0)`.mapWith(Number)
            })
            .from(ventasTable)
            .innerJoin(
                movimientosTable,
                and(eq(movimientosTable.id, ventasTable.id_movimiento), eq(movimientosTable.user, userId))
            )
            .where(filtroVentas(userId, tipos, desde, hasta))
            .groupBy(mesLocal());
    };

    // Ejemplares incorporados al stock (ingresos desde el exterior) en el
    // período. No responde al alcance de ventas ni incluye los ingresos que
    // reconstruyó la migración.
    const getEjemplaresNuevos = async (userId: number, desde: Date, hasta: Date): Promise<number> => {
        const [fila] = await db
            .select({ total: sql<number>`coalesce(sum(${movimientosLibrosTable.cantidad}), 0)`.mapWith(Number) })
            .from(movimientosLibrosTable)
            .innerJoin(
                movimientosTable,
                and(eq(movimientosTable.id, movimientosLibrosTable.movimiento_id), eq(movimientosTable.user, userId))
            )
            .where(
                and(
                    eq(movimientosTable.user, userId),
                    eq(movimientosTable.tipo, "ingreso"),
                    eq(movimientosTable.es_migracion, false),
                    gte(movimientosTable.fecha, desde),
                    lte(movimientosTable.fecha, hasta)
                )
            );

        return fila.total;
    };

    const getIngresoPorMedioPago = async (userId: number, tipos: TipoVenta[], desde: Date, hasta: Date) => {
        return db
            .select({
                medio: mediosPagoTable.nombre,
                ingreso: sql<number>`coalesce(sum(${ventasTable.total}), 0)`.mapWith(Number)
            })
            .from(ventasTable)
            .innerJoin(
                movimientosTable,
                and(eq(movimientosTable.id, ventasTable.id_movimiento), eq(movimientosTable.user, userId))
            )
            .innerJoin(
                mediosPagoTable,
                and(eq(mediosPagoTable.id, ventasTable.id_medio_pago), eq(mediosPagoTable.user, userId))
            )
            .where(filtroVentas(userId, tipos, desde, hasta))
            .groupBy(mediosPagoTable.id, mediosPagoTable.nombre)
            .orderBy(asc(mediosPagoTable.nombre));
    };

    return {
        getVentas,
        getLineas,
        getMeses,
        getIngresoPorMes,
        getEjemplaresNuevos,
        getIngresoPorMedioPago
    };
}

export type MetricasRepository = ReturnType<typeof createMetricasRepository>;
