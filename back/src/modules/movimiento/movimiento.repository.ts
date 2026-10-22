import { and, count, desc, eq, gte, inArray, lte, or, SQL, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { NotFound } from "bradb";
import { Database, Tx } from "../../db/client";
import { movimientosTable, movimientosLibrosTable } from "./movimiento.schema";
import { depositosTable } from "../deposito/deposito.schema";
import { librosTable } from "../libro/libro.schema";
import { clientesTable } from "../cliente/cliente.schema";
import { mediosPagoTable } from "../medioPago/medioPago.schema";
import { stockDeLibro } from "../libro/libro.stock";
import { ventasTable } from "../transaccion/venta.schema";
import { ListMovimientosFilter, MovimientoTipo } from "./movimiento.validator";
import { finDelDia } from "../../lib/fecha";
import { calcularNeto } from "../../lib/venta";

export type MovimientoRepositoryDeps = {
    db: Database;
};

export type LibroEnMovimiento = {
    id_libro: number;
    isbn: string;
    titulo: string;
    cantidad: number;
    precio: number | null;
    // Stock total derivado del libro (suma de depósitos, ver specs/008/009):
    // lo consumen las respuestas de las operaciones comerciales.
    stock: number;
};

export type VentaDeMovimiento = {
    tipo_cbte: number;
    medio_pago: { id: number; nombre: string; comision: number } | null;
    descuento: number | null;
    total: number;
    neto: number;
};

// Fila cruda del select base (antes de componer `venta` y `libros`).
export type MovimientoRow = {
    id: number;
    fecha: Date;
    tipo: MovimientoTipo;
    origen_tipo: string;
    origen_deposito_id: number | null;
    destino_tipo: string;
    destino_deposito_id: number | null;
    id_cliente: number | null;
    file_path: string | null;
    user: number;
    origen_nombre: string | null;
    destino_nombre: string | null;
    nombre_cliente: string | null;
    cuit: string | null;
    email: string | null;
    cond_fiscal: string | null;
    tipo_cliente: string | null;
    venta_tipo_cbte: number | null;
    venta_id_medio_pago: number | null;
    venta_medio_pago_nombre: string | null;
    venta_comision: number | null;
    venta_descuento: number | null;
    venta_total: number | null;
};

// Fila de movimiento con los nombres de depósito y cliente ya resueltos por
// join (siguen disponibles aunque el depósito/cliente se haya dado de baja
// lógica), su extensión de venta y sus libros.
export type MovimientoConDetalle = Omit<MovimientoRow, "venta_tipo_cbte" | "venta_id_medio_pago" | "venta_medio_pago_nombre" | "venta_comision" | "venta_descuento" | "venta_total"> & {
    venta: VentaDeMovimiento | null;
    libros: LibroEnMovimiento[];
};

export function createMovimientoRepository({ db }: MovimientoRepositoryDeps) {
    const origenDep = alias(depositosTable, "origen_deposito");
    const destinoDep = alias(depositosTable, "destino_deposito");

    // El cliente no vive en `movimientos`: sale de la venta
    // (`venta`/`ventaConsignacion`) o del extremo que es el depósito del
    // cliente (destino en consignación, origen en devolución). Se expone en la
    // respuesta y se filtra con la misma derivación.
    const idClienteExpr = sql<number | null>`coalesce(${ventasTable.id_cliente}, ${origenDep.id_cliente}, ${destinoDep.id_cliente})`;

    const selectBase = () =>
        db
            .select({
                id: movimientosTable.id,
                fecha: movimientosTable.fecha,
                tipo: movimientosTable.tipo,
                origen_tipo: movimientosTable.origen_tipo,
                origen_deposito_id: movimientosTable.origen_deposito_id,
                destino_tipo: movimientosTable.destino_tipo,
                destino_deposito_id: movimientosTable.destino_deposito_id,
                id_cliente: idClienteExpr,
                file_path: movimientosTable.file_path,
                user: movimientosTable.user,
                origen_nombre: origenDep.nombre,
                destino_nombre: destinoDep.nombre,
                nombre_cliente: clientesTable.nombre,
                cuit: clientesTable.cuit,
                email: clientesTable.email,
                cond_fiscal: clientesTable.cond_fiscal,
                tipo_cliente: clientesTable.tipo,
                venta_tipo_cbte: ventasTable.tipo_cbte,
                venta_id_medio_pago: ventasTable.id_medio_pago,
                venta_medio_pago_nombre: mediosPagoTable.nombre,
                venta_comision: ventasTable.comision,
                venta_descuento: ventasTable.descuento,
                venta_total: ventasTable.total
            })
            .from(movimientosTable)
            .leftJoin(
                origenDep,
                and(eq(origenDep.id, movimientosTable.origen_deposito_id), eq(origenDep.user, movimientosTable.user))
            )
            .leftJoin(
                destinoDep,
                and(eq(destinoDep.id, movimientosTable.destino_deposito_id), eq(destinoDep.user, movimientosTable.user))
            )
            .leftJoin(ventasTable, eq(ventasTable.id_movimiento, movimientosTable.id))
            .leftJoin(
                mediosPagoTable,
                and(eq(mediosPagoTable.id, ventasTable.id_medio_pago), eq(mediosPagoTable.user, movimientosTable.user))
            )
            .leftJoin(
                clientesTable,
                and(eq(clientesTable.id, idClienteExpr), eq(clientesTable.user, movimientosTable.user))
            )
            .$dynamic();

    // Una sola query para los libros de toda la página (evita N+1): el listado
    // ya trae sus libros, el detalle de una fila no necesita otra consulta.
    const getLibros = async (movimientoIds: number[], userId: number): Promise<Map<number, LibroEnMovimiento[]>> => {
        if (movimientoIds.length === 0) return new Map();

        const rows = await db
            .select({
                movimiento_id: movimientosLibrosTable.movimiento_id,
                id_libro: librosTable.id_libro,
                isbn: librosTable.isbn,
                titulo: librosTable.titulo,
                cantidad: movimientosLibrosTable.cantidad,
                precio: movimientosLibrosTable.precio,
                stock: stockDeLibro()
            })
            .from(movimientosLibrosTable)
            .innerJoin(
                librosTable,
                and(eq(librosTable.id_libro, movimientosLibrosTable.id_libro), eq(librosTable.user, movimientosLibrosTable.user))
            )
            .where(and(inArray(movimientosLibrosTable.movimiento_id, movimientoIds), eq(movimientosLibrosTable.user, userId)));

        const porMovimiento = new Map<number, LibroEnMovimiento[]>();
        for (const row of rows) {
            const libros = porMovimiento.get(row.movimiento_id) ?? [];
            const { movimiento_id, ...libro } = row;
            libros.push(libro);
            porMovimiento.set(movimiento_id, libros);
        }

        return porMovimiento;
    };

    // Extensión de venta derivada (sólo existe en `venta`/`ventaConsignacion`).
    const toVenta = (row: Pick<MovimientoRow, "venta_tipo_cbte" | "venta_id_medio_pago" | "venta_medio_pago_nombre" | "venta_comision" | "venta_descuento" | "venta_total">): VentaDeMovimiento | null => {
        if (row.venta_tipo_cbte === null) return null;

        const total = row.venta_total as number;
        const comision = row.venta_comision as number;

        return {
            tipo_cbte: row.venta_tipo_cbte,
            medio_pago: {
                id: row.venta_id_medio_pago as number,
                nombre: row.venta_medio_pago_nombre as string,
                comision
            },
            descuento: row.venta_descuento,
            total,
            neto: calcularNeto(total, comision)
        };
    };

    const toDetalle = (row: MovimientoRow, libros: LibroEnMovimiento[]): MovimientoConDetalle => {
        const { venta_tipo_cbte, venta_id_medio_pago, venta_medio_pago_nombre, venta_comision, venta_descuento, venta_total, ...base } = row;

        return {
            ...base,
            venta: toVenta({ venta_tipo_cbte, venta_id_medio_pago, venta_medio_pago_nombre, venta_comision, venta_descuento, venta_total }),
            libros
        };
    };

    const conLibros = async (rows: MovimientoRow[], userId: number): Promise<MovimientoConDetalle[]> => {
        const libros = await getLibros(rows.map((row) => row.id), userId);
        return rows.map((row) => toDetalle(row, libros.get(row.id) ?? []));
    };

    const buildFilterConditions = (userId: number, filter: ListMovimientosFilter): SQL | undefined => {
        const conditions: (SQL | undefined)[] = [eq(movimientosTable.user, userId)];

        if (filter.tipo !== undefined) conditions.push(eq(movimientosTable.tipo, filter.tipo));
        if (filter.deposito !== undefined) {
            conditions.push(
                or(
                    eq(movimientosTable.origen_deposito_id, filter.deposito),
                    eq(movimientosTable.destino_deposito_id, filter.deposito)
                )
            );
        }
        if (filter.cliente !== undefined) conditions.push(eq(idClienteExpr, filter.cliente));
        if (filter.desde !== undefined) conditions.push(gte(movimientosTable.fecha, filter.desde));
        if (filter.hasta !== undefined) conditions.push(lte(movimientosTable.fecha, finDelDia(filter.hasta)));

        return and(...conditions);
    };

    // `.$dynamic()` porque se arma dos veces (subquery de `count` + página
    // real, mismo patrón que `venta.repository.ts#getAll`).
    const buildFilteredQuery = (userId: number, filter: ListMovimientosFilter) =>
        selectBase().where(buildFilterConditions(userId, filter)).$dynamic();

    // Los filtros se aplican igual a la página y al `count` (si no, la
    // paginación mentiría): el total sale de contar la misma query filtrada
    // envuelta como subquery.
    const getAll = async (userId: number, filter: ListMovimientosFilter) => {
        const sub = buildFilteredQuery(userId, filter).as("sub");
        const [{ count: total }] = await db.select({ count: count() }).from(sub);

        const offset = (filter.pagina - 1) * filter.porPagina;
        const rows = await buildFilteredQuery(userId, filter)
            .orderBy(desc(movimientosTable.id))
            .limit(filter.porPagina)
            .offset(offset);

        return { movimientos: await conLibros(rows, userId), total };
    };

    const getById = async (id: number, userId: number): Promise<MovimientoConDetalle> => {
        const rows = await selectBase().where(and(eq(movimientosTable.id, id), eq(movimientosTable.user, userId)));

        if (rows.length === 0) throw new NotFound(`No se encontró el movimiento con id ${id}`);

        const [movimiento] = await conLibros(rows, userId);
        return movimiento;
    };

    // Movimientos de un tipo (para listar consignaciones/devoluciones).
    const getByTipo = async (tipo: MovimientoTipo, userId: number): Promise<MovimientoConDetalle[]> => {
        const rows = await selectBase()
            .where(and(eq(movimientosTable.tipo, tipo), eq(movimientosTable.user, userId)))
            .orderBy(desc(movimientosTable.id));

        return conLibros(rows, userId);
    };

    // Libros de un movimiento (usado por el detalle de las operaciones
    // comerciales, que expone `stock` por línea).
    const getLibrosDe = async (movimientoId: number, userId: number): Promise<LibroEnMovimiento[]> => {
        const libros = await getLibros([movimientoId], userId);
        return libros.get(movimientoId) ?? [];
    };

    const insert = async (body: typeof movimientosTable.$inferInsert, tx: Tx) => {
        const [row] = await tx.insert(movimientosTable).values(body).returning();
        return row;
    };

    const insertLibros = async (
        movimientoId: number,
        userId: number,
        libros: { id_libro: number; cantidad: number; precio: number | null }[],
        tx: Tx
    ): Promise<void> => {
        await tx.insert(movimientosLibrosTable).values(
            libros.map((libro) => ({
                movimiento_id: movimientoId,
                id_libro: libro.id_libro,
                cantidad: libro.cantidad,
                precio: libro.precio,
                user: userId
            }))
        );
    };

    return {
        getAll,
        getById,
        getByTipo,
        getLibrosDe,
        insert,
        insertLibros
    };
}

export type MovimientoRepository = ReturnType<typeof createMovimientoRepository>;
