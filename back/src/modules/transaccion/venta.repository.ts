import { and, count, desc, eq, gte, inArray, lte, SQL } from "drizzle-orm";
import { Database, Tx } from "../../db/client";
import { ventasTable } from "./venta.schema";
import { movimientosTable } from "../movimiento/movimiento.schema";
import { clientesTable } from "../cliente/cliente.schema";
import { mediosPagoTable } from "../medioPago/medioPago.schema";
import { VentaInsert, ListVentasFilter, tipoVentaValues } from "./venta.validator";
import { LibroOperacion } from "./operacion.types";
import { NotFound } from "bradb";
import { finDelDia } from "../../lib/fecha";

export type VentaRepositoryDeps = {
    db: Database;
};

export function createVentaRepository({ db }: VentaRepositoryDeps) {
    const insert = async (idMovimiento: number, body: Omit<VentaInsert, "id_movimiento">, tx: Tx) => {
        const [row] = await tx
            .insert(ventasTable)
            .values({ ...body, id_movimiento: idMovimiento })
            .returning();
        return row;
    };

    // Copia exacta de `Venta.calcTotal` (MySQL): función pura, sin cambios de lógica.
    const calcTotal = (libros: LibroOperacion[], descuento: number): number => {
        let total = libros.reduce((acumulador, libro) => acumulador + libro.cantidad * libro.precio, 0);

        total -= total * descuento * 0.01;
        total = parseFloat(total.toFixed(2));
        return total;
    };

    // Extensión de venta + su movimiento + cliente + medio de pago. `id`/
    // `type`/`fecha` salen del movimiento (la venta ya no es una entidad
    // aparte), pero se sigue exponiendo `id_transaccion` para no romper el
    // contrato del front. El medio se joinea por id y dueño: su nombre se lee
    // en vivo, así sigue siendo legible aunque esté dado de baja.
    const selectVentaConMovimiento = () =>
        db
            .select({
                id_transaccion: ventasTable.id_movimiento,
                descuento: ventasTable.descuento,
                total: ventasTable.total,
                comision: ventasTable.comision,
                id_medio_pago: ventasTable.id_medio_pago,
                medio_pago_nombre: mediosPagoTable.nombre,
                tipo_cbte: ventasTable.tipo_cbte,
                id: movimientosTable.id,
                fecha: movimientosTable.fecha,
                id_cliente: ventasTable.id_cliente,
                file_path: movimientosTable.file_path,
                type: movimientosTable.tipo,
                user: movimientosTable.user,
                nombre_cliente: clientesTable.nombre,
                cuit: clientesTable.cuit,
                email: clientesTable.email,
                cond_fiscal: clientesTable.cond_fiscal,
                tipo_cliente: clientesTable.tipo
            })
            .from(ventasTable)
            .innerJoin(movimientosTable, eq(movimientosTable.id, ventasTable.id_movimiento))
            .innerJoin(
                clientesTable,
                and(eq(clientesTable.id, ventasTable.id_cliente), eq(clientesTable.user, movimientosTable.user))
            )
            .innerJoin(
                mediosPagoTable,
                and(eq(mediosPagoTable.id, ventasTable.id_medio_pago), eq(mediosPagoTable.user, movimientosTable.user))
            );

    // Filtros combinables por AND: sin `tipo` trae los dos tipos de venta (en
    // firme + sobre consignado), igual que ya asumía el front (VentasPage.tsx,
    // columna "Tipo").
    const buildFilterConditions = (userId: number, filter: ListVentasFilter): SQL | undefined => {
        const conditions = [
            eq(movimientosTable.user, userId),
            inArray(movimientosTable.tipo, filter.tipo ? [filter.tipo] : tipoVentaValues)
        ];

        if (filter.cliente !== undefined) conditions.push(eq(ventasTable.id_cliente, filter.cliente));
        if (filter.medioPago !== undefined) conditions.push(eq(ventasTable.id_medio_pago, filter.medioPago));
        if (filter.desde !== undefined) conditions.push(gte(movimientosTable.fecha, filter.desde));
        if (filter.hasta !== undefined) conditions.push(lte(movimientosTable.fecha, finDelDia(filter.hasta)));

        return and(...conditions);
    };

    // `.$dynamic()` porque se arma dos veces (subquery de `count` + página
    // real, mismo patrón que `persona.repository.ts#getAllByRol`).
    const buildFilteredQuery = (userId: number, filter: ListVentasFilter) =>
        selectVentaConMovimiento().where(buildFilterConditions(userId, filter)).$dynamic();

    const getAll = async (userId: number, filter: ListVentasFilter): Promise<{ data: Awaited<ReturnType<typeof selectVentaConMovimiento>>; total: number }> => {
        const sub = buildFilteredQuery(userId, filter).as("sub");
        const [{ count: total }] = await db.select({ count: count() }).from(sub);

        const offset = (filter.page - 1) * filter.pageSize;
        const data = await buildFilteredQuery(userId, filter)
            .orderBy(desc(ventasTable.id_movimiento))
            .limit(filter.pageSize)
            .offset(offset);

        return { data, total };
    };

    const getById = async (id: number, userId: number) => {
        const rows = await selectVentaConMovimiento().where(
            and(eq(movimientosTable.id, id), eq(movimientosTable.user, userId))
        );

        if (rows.length === 0) throw new NotFound(`No se encontró la venta con id ${id}`);
        return rows[0];
    };

    // Fila cruda de `ventas` para el emisor de comprobantes (AFIP necesita los
    // importes, el tipo de comprobante y el cliente, no el join de lectura).
    const findRowByIdMovimiento = async (idMovimiento: number, userId: number) => {
        const [row] = await db
            .select({ venta: ventasTable })
            .from(ventasTable)
            .innerJoin(movimientosTable, eq(movimientosTable.id, ventasTable.id_movimiento))
            .where(
                and(
                    eq(ventasTable.id_movimiento, idMovimiento),
                    eq(movimientosTable.user, userId)
                )
            )
            .limit(1);

        return row?.venta ?? null;
    };

    return {
        insert,
        calcTotal,
        getAll,
        getById,
        findRowByIdMovimiento
    };
}

export type VentaRepository = ReturnType<typeof createVentaRepository>;
