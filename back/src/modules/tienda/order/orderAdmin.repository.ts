import { SQL, and, count, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import { Database } from "../../../db/client";
import { ordersTable, orderStatusEnum } from "./order.schema";
import { orderItemsTable } from "./orderItem.schema";

export type OrderStatus = (typeof orderStatusEnum.enumValues)[number];

export type ListOrdersFilter = {
    estado?: OrderStatus;
    desde?: Date;
    hasta?: Date;
    entrega?: "envio" | "retiro";
    buscar?: string;
    pagina: number;
    porPagina: number;
};

export type OrderSummaryRow = {
    codigo: string;
    creado_en: Date;
    comprador_nombre: string;
    comprador_email: string;
    comprador_telefono: string | null;
    total: number;
    estado_pago: string;
    entrega_tipo: "envio" | "retiro";
    estado: OrderStatus;
    cantidad_items: number;
};

export type OrdersPage = {
    pedidos: OrderSummaryRow[];
    total: number;
    conteos: Record<OrderStatus | "todos", number>;
};

export type OrderAdminRepositoryDeps = { db: Database };

const ESTADOS = orderStatusEnum.enumValues;

export function createOrderAdminRepository({ db }: OrderAdminRepositoryDeps) {
    const scopedConditions = (userId: number, filter: ListOrdersFilter): SQL[] => {
        const conditions: SQL[] = [eq(ordersTable.user, userId)];

        if (filter.desde) conditions.push(gte(ordersTable.creado_en, filter.desde));
        if (filter.hasta) conditions.push(lte(ordersTable.creado_en, filter.hasta));
        if (filter.entrega) conditions.push(eq(ordersTable.entrega_tipo, filter.entrega));

        if (filter.buscar) {
            const pattern = `%${filter.buscar}%`;
            conditions.push(
                or(
                    ilike(ordersTable.codigo, pattern),
                    ilike(ordersTable.comprador_nombre, pattern),
                    ilike(ordersTable.comprador_email, pattern),
                    ilike(ordersTable.comprador_telefono, pattern)
                )!
            );
        }

        return conditions;
    };

    const getCounts = async (base: SQL[]): Promise<Record<OrderStatus | "todos", number>> => {
        const rows = await db
            .select({ estado: ordersTable.estado, total: count() })
            .from(ordersTable)
            .where(and(...base))
            .groupBy(ordersTable.estado);

        const conteos = Object.fromEntries(
            ESTADOS.map((estado) => [estado, 0])
        ) as Record<OrderStatus, number>;

        for (const row of rows) conteos[row.estado] = Number(row.total);

        return {
            ...conteos,
            todos: Object.values(conteos).reduce((total, value) => total + value, 0)
        };
    };

    const getItemCounts = async (pedidoIds: number[], userId: number) => {
        if (pedidoIds.length === 0) return new Map<number, number>();

        const rows = await db
            .select({
                pedido_id: orderItemsTable.pedido_id,
                cantidad: sql<number>`coalesce(sum(${orderItemsTable.cantidad}), 0)`.mapWith(Number)
            })
            .from(orderItemsTable)
            .where(
                and(
                    eq(orderItemsTable.user, userId),
                    inArray(orderItemsTable.pedido_id, pedidoIds)
                )
            )
            .groupBy(orderItemsTable.pedido_id);

        return new Map(rows.map((row) => [row.pedido_id, Number(row.cantidad)]));
    };

    const list = async (userId: number, filter: ListOrdersFilter): Promise<OrdersPage> => {
        const base = scopedConditions(userId, filter);
        const conditions = filter.estado ? [...base, eq(ordersTable.estado, filter.estado)] : base;

        const [conteos, totalRows, rows] = await Promise.all([
            getCounts(base),
            db.select({ total: count() }).from(ordersTable).where(and(...conditions)),
            db
                .select({
                    id: ordersTable.id,
                    codigo: ordersTable.codigo,
                    creado_en: ordersTable.creado_en,
                    comprador_nombre: ordersTable.comprador_nombre,
                    comprador_email: ordersTable.comprador_email,
                    comprador_telefono: ordersTable.comprador_telefono,
                    total: ordersTable.total,
                    estado_pago: ordersTable.estado_pago,
                    entrega_tipo: ordersTable.entrega_tipo,
                    estado: ordersTable.estado
                })
                .from(ordersTable)
                .where(and(...conditions))
                .orderBy(desc(ordersTable.creado_en), desc(ordersTable.id))
                .limit(filter.porPagina)
                .offset((filter.pagina - 1) * filter.porPagina)
        ]);

        const itemCounts = await getItemCounts(rows.map((row) => row.id), userId);

        return {
            pedidos: rows.map(({ id, ...row }) => ({
                ...row,
                cantidad_items: itemCounts.get(id) ?? 0
            })),
            total: Number(totalRows[0]?.total ?? 0),
            conteos
        };
    };

    return { list };
}

export type OrderAdminRepository = ReturnType<typeof createOrderAdminRepository>;
