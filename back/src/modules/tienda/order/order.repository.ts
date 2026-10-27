import { and, asc, desc, eq, like, sql } from "drizzle-orm";
import { NotFound } from "bradb";
import { Database, Tx } from "../../../db/client";
import { ordersTable } from "./order.schema";
import { orderItemsTable } from "./orderItem.schema";
import { orderHistoryTable } from "./orderHistory.schema";
import { reservationsTable } from "../stock/reservation.schema";

export type OrderRepositoryDeps = { db: Database };
export type OrderRow = typeof ordersTable.$inferSelect;
export type OrderItemRow = typeof orderItemsTable.$inferSelect;
export type OrderHistoryRow = typeof orderHistoryTable.$inferSelect;
export type OrderInsert = typeof ordersTable.$inferInsert;

export type OrderDetail = {
    pedido: OrderRow;
    items: OrderItemRow[];
    historial: OrderHistoryRow[];
};

export function createOrderRepository({ db }: OrderRepositoryDeps) {
    const findByIdempotency = async (
        integracionId: number,
        clave: string,
        tx?: Tx
    ): Promise<OrderRow | null> => {
        const [row] = await (tx ?? db)
            .select()
            .from(ordersTable)
            .where(
                and(
                    eq(ordersTable.integracion_id, integracionId),
                    eq(ordersTable.clave_idempotencia, clave)
                )
            )
            .limit(1);

        return row ?? null;
    };

    const findByCode = async (
        userId: number,
        codigo: string,
        tx?: Tx,
        bloquear = false
    ): Promise<OrderRow> => {
        const query = (tx ?? db)
            .select()
            .from(ordersTable)
            .where(and(eq(ordersTable.user, userId), eq(ordersTable.codigo, codigo)))
            .limit(1)
            .$dynamic();

        const [row] = bloquear ? await query.for("update", { of: [ordersTable] }) : await query;
        if (!row) throw new NotFound(`No existe el pedido ${codigo}`);
        return row;
    };

    const findById = async (userId: number, id: number, tx?: Tx): Promise<OrderRow> => {
        const [row] = await (tx ?? db)
            .select()
            .from(ordersTable)
            .where(and(eq(ordersTable.user, userId), eq(ordersTable.id, id)))
            .limit(1);

        if (!row) throw new NotFound(`No existe el pedido ${id}`);
        return row;
    };

    const findByExternalReference = async (
        userId: number,
        referencia: string,
        tx?: Tx,
        bloquear = false
    ): Promise<OrderRow | null> => {
        const query = (tx ?? db)
            .select()
            .from(ordersTable)
            .where(
                and(
                    eq(ordersTable.user, userId),
                    eq(ordersTable.referencia_externa, referencia)
                )
            )
            .limit(1)
            .$dynamic();

        const [row] = bloquear ? await query.for("update", { of: [ordersTable] }) : await query;
        return row ?? null;
    };

    // Código correlativo por cuenta. El advisory lock serializa la generación
    // para que dos checkouts concurrentes no elijan el mismo número.
    const nextCode = async (userId: number, tx: Tx): Promise<string> => {
        const lock = `pedidos:${userId}`;
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lock}))`);

        const year = new Date().getFullYear();
        const prefijo = `PED-${year}-`;
        const [ultimo] = await tx
            .select({ codigo: ordersTable.codigo })
            .from(ordersTable)
            .where(and(eq(ordersTable.user, userId), like(ordersTable.codigo, `${prefijo}%`)))
            .orderBy(desc(ordersTable.codigo))
            .limit(1);

        const numero = ultimo ? Number(ultimo.codigo.slice(prefijo.length)) + 1 : 1;
        return `${prefijo}${String(numero).padStart(6, "0")}`;
    };

    const insertOrder = async (values: OrderInsert, tx: Tx): Promise<OrderRow> => {
        const [row] = await tx.insert(ordersTable).values(values).returning();
        return row;
    };

    const insertItems = async (
        pedidoId: number,
        userId: number,
        items: { idLibro?: number; isbn: string; titulo: string; precioUnitario: number; cantidad: number; subtotal: number }[],
        tx: Tx
    ): Promise<void> => {
        await tx.insert(orderItemsTable).values(
            items.map((item) => ({
                user: userId,
                pedido_id: pedidoId,
                id_libro: item.idLibro ?? null,
                isbn: item.isbn,
                titulo: item.titulo,
                precio_unitario: item.precioUnitario,
                cantidad: item.cantidad,
                subtotal: item.subtotal
            }))
        );
    };

    const insertHistory = async (
        pedidoId: number,
        userId: number,
        tipo: string,
        descripcion: string,
        tx?: Tx
    ): Promise<void> => {
        await (tx ?? db).insert(orderHistoryTable).values({
            user: userId,
            pedido_id: pedidoId,
            tipo,
            descripcion
        });
    };

    const hasHistory = async (
        pedidoId: number,
        userId: number,
        tipo: string,
        tx?: Tx
    ): Promise<boolean> => {
        const [row] = await (tx ?? db)
            .select({ id: orderHistoryTable.id })
            .from(orderHistoryTable)
            .where(
                and(
                    eq(orderHistoryTable.pedido_id, pedidoId),
                    eq(orderHistoryTable.user, userId),
                    eq(orderHistoryTable.tipo, tipo)
                )
            )
            .limit(1);

        return Boolean(row);
    };

    const updateOrder = async (
        userId: number,
        id: number,
        values: Partial<OrderInsert>,
        tx?: Tx
    ): Promise<OrderRow> => {
        const [row] = await (tx ?? db)
            .update(ordersTable)
            .set({ ...values, actualizado_en: new Date() })
            .where(and(eq(ordersTable.user, userId), eq(ordersTable.id, id)))
            .returning();

        return row;
    };

    const getItems = async (pedidoId: number, userId: number, tx?: Tx): Promise<OrderItemRow[]> =>
        (tx ?? db)
            .select()
            .from(orderItemsTable)
            .where(and(eq(orderItemsTable.pedido_id, pedidoId), eq(orderItemsTable.user, userId)))
            .orderBy(asc(orderItemsTable.id));

    const getHistory = async (
        pedidoId: number,
        userId: number,
        tx?: Tx
    ): Promise<OrderHistoryRow[]> =>
        (tx ?? db)
            .select()
            .from(orderHistoryTable)
            .where(
                and(eq(orderHistoryTable.pedido_id, pedidoId), eq(orderHistoryTable.user, userId))
            )
            .orderBy(asc(orderHistoryTable.fecha), asc(orderHistoryTable.id));

    const getFull = async (userId: number, codigo: string, tx?: Tx): Promise<OrderDetail> => {
        const pedido = await findByCode(userId, codigo, tx);
        const [items, historial] = await Promise.all([
            getItems(pedido.id, userId, tx),
            getHistory(pedido.id, userId, tx)
        ]);

        return { pedido, items, historial };
    };

    const getReservationExpiration = async (
        pedidoId: number,
        userId: number,
        tx?: Tx
    ): Promise<Date | null> => {
        const [row] = await (tx ?? db)
            .select({ expira_en: reservationsTable.expira_en })
            .from(reservationsTable)
            .where(
                and(
                    eq(reservationsTable.pedido_id, pedidoId),
                    eq(reservationsTable.user, userId),
                    eq(reservationsTable.estado, "activa")
                )
            )
            .orderBy(asc(reservationsTable.expira_en))
            .limit(1);

        return row?.expira_en ?? null;
    };

    const findOverduePending = async (): Promise<{ id: number; user: number; codigo: string }[]> => {
        const rows = await db
            .selectDistinct({
                id: ordersTable.id,
                user: ordersTable.user,
                codigo: ordersTable.codigo
            })
            .from(ordersTable)
            .innerJoin(
                reservationsTable,
                and(
                    eq(reservationsTable.pedido_id, ordersTable.id),
                    eq(reservationsTable.user, ordersTable.user)
                )
            )
            .where(
                and(
                    eq(ordersTable.estado, "pendiente_pago"),
                    eq(reservationsTable.estado, "activa"),
                    sql`${reservationsTable.expira_en} <= now()`
                )
            );

        return rows;
    };

    return {
        findByIdempotency,
        findByCode,
        findById,
        findByExternalReference,
        nextCode,
        insertOrder,
        insertItems,
        insertHistory,
        hasHistory,
        updateOrder,
        getItems,
        getHistory,
        getFull,
        getReservationExpiration,
        findOverduePending
    };
}

export type OrderRepository = ReturnType<typeof createOrderRepository>;
