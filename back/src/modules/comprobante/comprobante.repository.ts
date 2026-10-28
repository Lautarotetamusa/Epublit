import { and, eq, inArray, sql } from "drizzle-orm";
import { Database, Tx } from "../../db/client";
import { comprobantesTable, facturasTable } from "./comprobante.schema";
import type { ComprobanteInsert, FacturaInsert } from "./comprobante.validator";

export type ComprobanteRepositoryDeps = {
    db: Database;
};

export type ComprobanteRow = typeof comprobantesTable.$inferSelect;
export type FacturaRow = typeof facturasTable.$inferSelect;
export type ComprobanteResumenRow = Pick<
    ComprobanteRow,
    "id" | "movimiento_id" | "tipo" | "estado" | "punto_venta" | "numero" | "fecha"
>;

export type ComprobanteConFactura = {
    comprobante: ComprobanteRow;
    factura: FacturaRow | null;
};

export type EmisionDatos = {
    numero: number;
    fecha: string;
    cae: string;
    caeVencimiento: string;
    resultado: "A" | "R";
    observaciones: unknown[];
    importeTotal: number;
    qrUrl: string;
    datosAfip: Record<string, unknown>;
};

const resumenColumns = {
    id: comprobantesTable.id,
    movimiento_id: comprobantesTable.movimiento_id,
    tipo: comprobantesTable.tipo,
    estado: comprobantesTable.estado,
    punto_venta: comprobantesTable.punto_venta,
    numero: comprobantesTable.numero,
    fecha: comprobantesTable.fecha
};

export function createComprobanteRepository({ db }: ComprobanteRepositoryDeps) {
    const insert = async (values: ComprobanteInsert, tx: Tx): Promise<ComprobanteRow> => {
        const [row] = await tx.insert(comprobantesTable).values(values).returning();
        return row;
    };

    const insertFactura = async (values: FacturaInsert, tx: Tx): Promise<FacturaRow> => {
        const [row] = await tx.insert(facturasTable).values(values).returning();
        return row;
    };

    const findById = async (
        id: number,
        userId: number,
        tx?: Tx,
        bloquear = false
    ): Promise<ComprobanteConFactura | null> => {
        const query = (tx ?? db)
            .select({ comprobante: comprobantesTable, factura: facturasTable })
            .from(comprobantesTable)
            .leftJoin(facturasTable, eq(facturasTable.comprobante_id, comprobantesTable.id))
            .where(and(eq(comprobantesTable.id, id), eq(comprobantesTable.user, userId)))
            .limit(1)
            .$dynamic();

        const [row] = bloquear
            ? await query.for("update", { of: [comprobantesTable] })
            : await query;

        return row ?? null;
    };

    const findByMovimientoId = async (
        movimientoId: number,
        userId: number,
        tx?: Tx
    ): Promise<ComprobanteResumenRow | null> => {
        const [row] = await (tx ?? db)
            .select(resumenColumns)
            .from(comprobantesTable)
            .where(and(eq(comprobantesTable.movimiento_id, movimientoId), eq(comprobantesTable.user, userId)))
            .limit(1);

        return row ?? null;
    };

    const findByMovimientoIds = async (
        movimientoIds: number[],
        userId: number
    ): Promise<ComprobanteResumenRow[]> => {
        if (movimientoIds.length === 0) return [];

        return db
            .select(resumenColumns)
            .from(comprobantesTable)
            .where(
                and(
                    inArray(comprobantesTable.movimiento_id, movimientoIds),
                    eq(comprobantesTable.user, userId)
                )
            );
    };

    // Claim atómico: un solo intento puede estar en curso por comprobante. Si
    // el proceso muere, `procesando_desde` vence a los 5 minutos.
    const marcarProcesando = async (
        id: number,
        userId: number,
        numeroEsperado: number,
        tx: Tx
    ): Promise<FacturaRow> => {
        await tx
            .update(comprobantesTable)
            .set({ actualizado_en: new Date() })
            .where(and(eq(comprobantesTable.id, id), eq(comprobantesTable.user, userId)));

        const [factura] = await tx
            .update(facturasTable)
            .set({
                numero_esperado: numeroEsperado,
                procesando_desde: new Date(),
                ultimo_intento_en: new Date(),
                intentos: sql`${facturasTable.intentos} + 1`,
                error_codigo: null,
                error_mensaje: null
            })
            .where(eq(facturasTable.comprobante_id, id))
            .returning();

        return factura;
    };

    const marcarEmitida = async (
        id: number,
        userId: number,
        datos: EmisionDatos,
        tx: Tx
    ): Promise<ComprobanteConFactura> => {
        await tx
            .update(comprobantesTable)
            .set({
                estado: "emitida",
                numero: datos.numero,
                fecha: datos.fecha,
                importe_total: datos.importeTotal,
                actualizado_en: new Date()
            })
            .where(and(eq(comprobantesTable.id, id), eq(comprobantesTable.user, userId)));

        await tx
            .update(facturasTable)
            .set({
                cae: datos.cae,
                cae_vencimiento: datos.caeVencimiento,
                resultado: datos.resultado,
                observaciones: datos.observaciones,
                datos_afip: datos.datosAfip,
                qr_url: datos.qrUrl,
                numero_esperado: datos.numero,
                error_codigo: null,
                error_mensaje: null,
                procesando_desde: null,
                ultimo_intento_en: new Date(),
                emitido_en: new Date()
            })
            .where(eq(facturasTable.comprobante_id, id));

        const actualizado = await findById(id, userId, tx);
        if (!actualizado) throw new Error(`No se encontró el comprobante ${id} después de emitirlo`);

        return actualizado;
    };

    const marcarError = async (
        id: number,
        userId: number,
        error: { codigo: string | null; mensaje: string },
        tx: Tx
    ): Promise<void> => {
        await tx
            .update(comprobantesTable)
            .set({ estado: "error", actualizado_en: new Date() })
            .where(and(eq(comprobantesTable.id, id), eq(comprobantesTable.user, userId)));

        await tx
            .update(facturasTable)
            .set({
                error_codigo: error.codigo,
                error_mensaje: error.mensaje,
                procesando_desde: null,
                ultimo_intento_en: new Date()
            })
            .where(eq(facturasTable.comprobante_id, id));
    };

    return {
        insert,
        insertFactura,
        findById,
        findByMovimientoId,
        findByMovimientoIds,
        marcarProcesando,
        marcarEmitida,
        marcarError
    };
}

export type ComprobanteRepository = ReturnType<typeof createComprobanteRepository>;
