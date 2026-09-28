import { and, count, desc, eq, gte, inArray, lte, SQL } from "drizzle-orm";
import { Database, Tx } from "../../db/client";
import { ventasTable } from "./venta.schema";
import { transaccionesTable } from "./transaccion.schema";
import { clientesTable } from "../cliente/cliente.schema";
import { VentaInsert, ListVentasFilter, tipoVentaValues } from "./venta.validator";
import { LibroOperacion } from "./operacion.types";
import { NotFound } from "bradb";

const MS_POR_DIA = 24 * 60 * 60 * 1000;

// `hasta` llega como fecha "pelada" (00:00:00 del día), pero tiene que ser
// inclusive: se corre al último milisegundo de ese mismo día antes de
// compararla contra `transacciones.fecha` (timestamp completo).
const finDelDia = (fecha: Date): Date => new Date(fecha.getTime() + MS_POR_DIA - 1);

export type VentaRepositoryDeps = {
    db: Database;
};

export function createVentaRepository({ db }: VentaRepositoryDeps) {
    const insert = async (idTransaccion: number, body: Omit<VentaInsert, "id_transaccion">, tx: Tx) => {
        const [row] = await tx
            .insert(ventasTable)
            .values({ ...body, id_transaccion: idTransaccion })
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

    const selectVentaConTransaccion = () =>
        db
            .select({
                id_transaccion: ventasTable.id_transaccion,
                descuento: ventasTable.descuento,
                total: ventasTable.total,
                medio_pago: ventasTable.medio_pago,
                tipo_cbte: ventasTable.tipo_cbte,
                id: transaccionesTable.id,
                fecha: transaccionesTable.fecha,
                id_cliente: transaccionesTable.id_cliente,
                file_path: transaccionesTable.file_path,
                type: transaccionesTable.type,
                user: transaccionesTable.user,
                nombre_cliente: clientesTable.nombre,
                cuit: clientesTable.cuit,
                email: clientesTable.email,
                cond_fiscal: clientesTable.cond_fiscal,
                tipo_cliente: clientesTable.tipo
            })
            .from(ventasTable)
            .innerJoin(transaccionesTable, eq(transaccionesTable.id, ventasTable.id_transaccion))
            .innerJoin(clientesTable, eq(clientesTable.id, transaccionesTable.id_cliente));

    // Filtros combinables por AND (ver plan, "Diseño de API"): sin `tipo`
    // trae los dos tipos de venta (en firme + sobre consignado), igual que
    // ya asumía el front (VentasPage.tsx, columna "Tipo").
    const buildFilterConditions = (userId: number, filter: ListVentasFilter): SQL | undefined => {
        const conditions = [
            eq(transaccionesTable.user, userId),
            inArray(transaccionesTable.type, filter.tipo ? [filter.tipo] : tipoVentaValues)
        ];

        if (filter.cliente !== undefined) conditions.push(eq(transaccionesTable.id_cliente, filter.cliente));
        if (filter.medioPago !== undefined) conditions.push(eq(ventasTable.medio_pago, filter.medioPago));
        if (filter.desde !== undefined) conditions.push(gte(transaccionesTable.fecha, filter.desde));
        if (filter.hasta !== undefined) conditions.push(lte(transaccionesTable.fecha, finDelDia(filter.hasta)));

        return and(...conditions);
    };

    // `.$dynamic()` porque se arma dos veces (subquery de `count` + página
    // real, mismo patrón que `persona.repository.ts#getAllByTipo`).
    const buildFilteredQuery = (userId: number, filter: ListVentasFilter) =>
        selectVentaConTransaccion().where(buildFilterConditions(userId, filter)).$dynamic();

    const getAll = async (userId: number, filter: ListVentasFilter): Promise<{ data: Awaited<ReturnType<typeof selectVentaConTransaccion>>; total: number }> => {
        const sub = buildFilteredQuery(userId, filter).as("sub");
        const [{ count: total }] = await db.select({ count: count() }).from(sub);

        const offset = (filter.page - 1) * filter.pageSize;
        const data = await buildFilteredQuery(userId, filter)
            .orderBy(desc(ventasTable.id_transaccion))
            .limit(filter.pageSize)
            .offset(offset);

        return { data, total };
    };

    const getById = async (id: number, userId: number) => {
        const rows = await selectVentaConTransaccion().where(
            and(eq(transaccionesTable.id, id), eq(transaccionesTable.user, userId))
        );

        if (rows.length === 0) throw new NotFound(`No se encontró la venta con id ${id}`);
        return rows[0];
    };

    return {
        insert,
        calcTotal,
        getAll,
        getById
    };
}

export type VentaRepository = ReturnType<typeof createVentaRepository>;
