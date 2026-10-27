import { and, eq } from "drizzle-orm";
import { Database, Tx } from "../../../db/client";
import { webhookEventsTable } from "./payment.schema";

export type WebhookRepositoryDeps = { db: Database };

export function createWebhookRepository({ db }: WebhookRepositoryDeps) {
    // Devuelve false si el evento ya existía: la unique (proveedor, evento_id)
    // es la que garantiza idempotencia ante reintentos concurrentes.
    const insertEvent = async (
        values: {
            proveedor: string;
            eventoId: string;
            tipo: string | null;
            payload: unknown;
            user?: number | null;
        },
        tx: Tx
    ): Promise<number | null> => {
        const [row] = await tx
            .insert(webhookEventsTable)
            .values({
                proveedor: values.proveedor,
                evento_id: values.eventoId,
                tipo: values.tipo,
                payload: values.payload,
                user: values.user ?? null
            })
            .onConflictDoNothing({
                target: [webhookEventsTable.proveedor, webhookEventsTable.evento_id]
            })
            .returning({ id: webhookEventsTable.id });

        return row?.id ?? null;
    };

    const markProcessed = async (id: number, user: number, tx: Tx): Promise<void> => {
        await tx
            .update(webhookEventsTable)
            .set({ procesado_en: new Date(), user })
            .where(eq(webhookEventsTable.id, id));
    };

    const findEvent = async (proveedor: string, eventoId: string) => {
        const [row] = await db
            .select()
            .from(webhookEventsTable)
            .where(
                and(
                    eq(webhookEventsTable.proveedor, proveedor),
                    eq(webhookEventsTable.evento_id, eventoId)
                )
            )
            .limit(1);

        return row ?? null;
    };

    return { insertEvent, markProcessed, findEvent };
}

export type WebhookRepository = ReturnType<typeof createWebhookRepository>;
