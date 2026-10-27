import { and, desc, eq } from "drizzle-orm";
import { Database, Tx } from "../../../db/client";
import { paymentsTable } from "./payment.schema";

export type PaymentRepositoryDeps = { db: Database };
export type PaymentRow = typeof paymentsTable.$inferSelect;
export type PaymentInsert = typeof paymentsTable.$inferInsert;
export type PaymentStatus = PaymentRow["estado"];

export function createPaymentRepository({ db }: PaymentRepositoryDeps) {
    const findLatestForOrder = async (
        pedidoId: number,
        userId: number,
        tx?: Tx
    ): Promise<PaymentRow | null> => {
        const [row] = await (tx ?? db)
            .select()
            .from(paymentsTable)
            .where(and(eq(paymentsTable.pedido_id, pedidoId), eq(paymentsTable.user, userId)))
            .orderBy(desc(paymentsTable.creado_en), desc(paymentsTable.id))
            .limit(1);

        return row ?? null;
    };

    const findByPagoId = async (pagoId: string, tx?: Tx): Promise<PaymentRow | null> => {
        const [row] = await (tx ?? db)
            .select()
            .from(paymentsTable)
            .where(eq(paymentsTable.pago_id, pagoId))
            .limit(1);
        return row ?? null;
    };

    const findByPreferenciaId = async (preferenciaId: string): Promise<PaymentRow | null> => {
        const [row] = await db
            .select()
            .from(paymentsTable)
            .where(eq(paymentsTable.preferencia_id, preferenciaId))
            .limit(1);

        return row ?? null;
    };

    const insert = async (values: PaymentInsert, tx?: Tx): Promise<PaymentRow> => {
        const [row] = await (tx ?? db).insert(paymentsTable).values(values).returning();
        return row;
    };

    const update = async (
        id: number,
        userId: number,
        values: Partial<PaymentInsert>,
        tx?: Tx
    ): Promise<PaymentRow> => {
        const [row] = await (tx ?? db)
            .update(paymentsTable)
            .set({ ...values, actualizado_en: new Date() })
            .where(and(eq(paymentsTable.id, id), eq(paymentsTable.user, userId)))
            .returning();

        return row;
    };

    const updateLatestForOrder = async (
        pedidoId: number,
        userId: number,
        values: Partial<PaymentInsert>,
        tx?: Tx
    ): Promise<PaymentRow | null> => {
        const latest = await findLatestForOrder(pedidoId, userId, tx);
        if (!latest) return null;

        return update(latest.id, userId, values, tx);
    };

    return {
        findLatestForOrder,
        findByPagoId,
        findByPreferenciaId,
        insert,
        update,
        updateLatestForOrder
    };
}

export type PaymentRepository = ReturnType<typeof createPaymentRepository>;
