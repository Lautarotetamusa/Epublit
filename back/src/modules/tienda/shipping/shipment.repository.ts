import { and, desc, eq } from "drizzle-orm";
import { Database, Tx } from "../../../db/client";
import { shipmentEventsTable, shipmentsTable } from "./shipping.schema";

export type ShipmentRepositoryDeps = { db: Database };
export type ShipmentRow = typeof shipmentsTable.$inferSelect;
export type ShipmentInsert = typeof shipmentsTable.$inferInsert;
export type ShipmentEventRow = typeof shipmentEventsTable.$inferSelect;
export type ShipmentEventInsert = typeof shipmentEventsTable.$inferInsert;

export function createShipmentRepository({ db }: ShipmentRepositoryDeps) {
    const findByOrder = async (
        pedidoId: number,
        userId: number,
        tx?: Tx
    ): Promise<ShipmentRow | null> => {
        const [row] = await (tx ?? db)
            .select()
            .from(shipmentsTable)
            .where(and(eq(shipmentsTable.pedido_id, pedidoId), eq(shipmentsTable.user, userId)))
            .limit(1);

        return row ?? null;
    };

    const insert = async (values: ShipmentInsert, tx?: Tx): Promise<ShipmentRow> => {
        const [row] = await (tx ?? db).insert(shipmentsTable).values(values).returning();
        return row;
    };

    const update = async (
        id: number,
        userId: number,
        values: Partial<ShipmentInsert>,
        tx?: Tx
    ): Promise<ShipmentRow> => {
        const [row] = await (tx ?? db)
            .update(shipmentsTable)
            .set({ ...values, actualizado_en: new Date() })
            .where(and(eq(shipmentsTable.id, id), eq(shipmentsTable.user, userId)))
            .returning();

        return row;
    };

    const getEvents = async (
        envioId: number,
        userId: number,
        tx?: Tx
    ): Promise<ShipmentEventRow[]> =>
        (tx ?? db)
            .select()
            .from(shipmentEventsTable)
            .where(
                and(
                    eq(shipmentEventsTable.envio_id, envioId),
                    eq(shipmentEventsTable.user, userId)
                )
            )
            .orderBy(
                desc(shipmentEventsTable.fecha_evento),
                desc(shipmentEventsTable.id)
            );

    // Deduplicado por identificador estable del evento: repetir un refresh no
    // inserta dos veces el mismo hito del proveedor.
    const insertEvent = async (
        values: ShipmentEventInsert,
        tx?: Tx
    ): Promise<ShipmentEventRow | null> => {
        const [row] = await (tx ?? db)
            .insert(shipmentEventsTable)
            .values(values)
            .onConflictDoNothing({
                target: [shipmentEventsTable.envio_id, shipmentEventsTable.evento_proveedor_id]
            })
            .returning();

        return row ?? null;
    };

    return {
        findByOrder,
        insert,
        update,
        getEvents,
        insertEvent
    };
}

export type ShipmentRepository = ReturnType<typeof createShipmentRepository>;
