import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { Database, Tx } from "../../../db/client";
import { DepositoRepository } from "../../deposito";
import { StockInsuficiente } from "../../../lib/http/errors";
import { disponibleParaVenta, reservasActivasDeLibro } from "../../libro/libro.stock";
import { librosTable } from "../../libro/libro.schema";
import { depositoLibrosTable } from "../../deposito/depositoLibros.schema";
import { reservationsTable } from "./reservation.schema";

export type ItemStock = {
    id_libro: number;
    isbn: string;
    titulo: string;
    cantidad: number;
};

export type BookAvailability = {
    id_libro: number;
    fisico: number;
    reservado: number;
    limiteNegativo: number;
    // Físico menos reservas activas: puede ser negativo.
    disponible: number;
    // Disponible + límite negativo, nunca menor que cero.
    disponibleParaVenta: number;
};

export type AvailabilityServiceDeps = {
    db: Database;
    depositoRepository: Pick<DepositoRepository, "findPrincipal">;
};

// Única implementación de la disponibilidad del depósito principal (ver
// specs/016-tienda-ecommerce, tarea 5). El bloqueo de las filas de libro, en
// orden determinista por id, serializa reservas y ventas internas que compiten
// por el mismo ejemplar.
export function createAvailabilityService({ db, depositoRepository }: AvailabilityServiceDeps) {
    const get = async (
        depositoId: number,
        items: ItemStock[],
        userId: number,
        tx: Tx | undefined,
        bloquear: boolean
    ): Promise<BookAvailability[]> => {
        if (items.length === 0) return [];

        const ids = [...new Set(items.map((item) => item.id_libro))].sort((a, b) => a - b);

        const filtro = and(
            eq(librosTable.user, userId),
            isNull(librosTable.deletedAt),
            inArray(librosTable.id_libro, ids)
        );

        // El bloqueo se hace en un statement propio y en orden de id. La
        // lectura de stock/reservas va después, en otro statement: así una
        // transacción que esperó el lock ve el commit de la que ganó y no
        // decide con un snapshot viejo (READ COMMITTED).
        if (bloquear) {
            await (tx ?? db)
                .select({ id_libro: librosTable.id_libro })
                .from(librosTable)
                .where(filtro)
                .orderBy(asc(librosTable.id_libro))
                .for("update", { of: [librosTable] });
        }

        const rows = await (tx ?? db)
            .select({
                id_libro: librosTable.id_libro,
                fisico: sql<number>`coalesce(${depositoLibrosTable.cantidad}, 0)`.mapWith(Number),
                reservado: reservasActivasDeLibro(),
                limiteNegativo: librosTable.stock_negativo_permitido
            })
            .from(librosTable)
            .leftJoin(
                depositoLibrosTable,
                and(
                    eq(depositoLibrosTable.id_libro, librosTable.id_libro),
                    eq(depositoLibrosTable.deposito_id, depositoId),
                    eq(depositoLibrosTable.user, userId)
                )
            )
            .where(filtro)
            .orderBy(asc(librosTable.id_libro));

        return rows.map((row) => {
            const disponible = row.fisico - row.reservado;

            return {
                id_libro: row.id_libro,
                fisico: row.fisico,
                reservado: row.reservado,
                limiteNegativo: row.limiteNegativo,
                disponible,
                disponibleParaVenta: disponibleParaVenta(disponible, row.limiteNegativo)
            };
        });
    };

    const missingStock = (items: ItemStock[], disponibilidades: BookAvailability[]) => {
        const porLibro = new Map(disponibilidades.map((d) => [d.id_libro, d]));

        return items
            .filter((item) => (porLibro.get(item.id_libro)?.disponibleParaVenta ?? 0) < item.cantidad)
            .map((item) => ({
                isbn: item.isbn,
                titulo: item.titulo,
                pedido: item.cantidad,
                disponible: porLibro.get(item.id_libro)?.disponibleParaVenta ?? 0
            }));
    };

    const assertCanReserve = (
        items: ItemStock[],
        disponibilidades: BookAvailability[]
    ) => {
        const sinStock = missingStock(items, disponibilidades);
        if (sinStock.length > 0) {
            throw new StockInsuficiente("No hay stock suficiente para la operación", sinStock);
        }
    };

    const getAvailability = async (items: ItemStock[], userId: number, tx?: Tx) => {
        const deposito = await depositoRepository.findPrincipal(userId);
        return get(deposito.id, items, userId, tx, false);
    };

    // Reserva todos los ítems en una única transacción: si uno no alcanza, no
    // queda ninguna reserva (el 409 se tira antes de insertar).
    const reserve = async (
        pedidoId: number,
        items: ItemStock[],
        userId: number,
        expiraEn: Date,
        tx?: Tx
    ) => {
        const execute = async (trx: Tx) => {
            const deposito = await depositoRepository.findPrincipal(userId);
            const disponibilidades = await get(deposito.id, items, userId, trx, true);
            assertCanReserve(items, disponibilidades);

            await trx.insert(reservationsTable).values(
                items.map((item) => ({
                    user: userId,
                    pedido_id: pedidoId,
                    id_libro: item.id_libro,
                    deposito_id: deposito.id,
                    cantidad: item.cantidad,
                    expira_en: expiraEn
                }))
            );

            return disponibilidades;
        };

        return tx ? execute(tx) : db.transaction(execute);
    };

    // Valida una salida del depósito (venta interna) con las filas bloqueadas.
    // `aplicarLimite` es true sólo para la venta de mostrador: la consignación
    // sigue exigiendo stock físico.
    const availableForOperation = (
        disponibilidad: BookAvailability | undefined,
        aplicarLimite: boolean
    ): number => {
        if (!disponibilidad) return 0;
        if (aplicarLimite) return disponibilidad.disponibleParaVenta;

        return Math.max(0, disponibilidad.disponible);
    };

    const assertCanSell = async (
        depositoId: number,
        items: ItemStock[],
        userId: number,
        aplicarLimite: boolean,
        tx: Tx
    ) => {
        const disponibilidades = await get(depositoId, items, userId, tx, true);
        const porLibro = new Map(disponibilidades.map((d) => [d.id_libro, d]));

        const sinStock = items
            .filter(
                (item) =>
                    availableForOperation(porLibro.get(item.id_libro), aplicarLimite) < item.cantidad
            )
            .map((item) => ({
                isbn: item.isbn,
                titulo: item.titulo,
                pedido: item.cantidad,
                disponible: availableForOperation(porLibro.get(item.id_libro), aplicarLimite)
            }));

        if (sinStock.length > 0) {
            throw new StockInsuficiente("No hay stock suficiente para la operación", sinStock);
        }

        return disponibilidades;
    };

    const release = async (pedidoId: number, userId: number, tx?: Tx) => {
        await (tx ?? db)
            .update(reservationsTable)
            .set({ estado: "liberada", actualizada_en: new Date() })
            .where(
                and(
                    eq(reservationsTable.pedido_id, pedidoId),
                    eq(reservationsTable.user, userId),
                    eq(reservationsTable.estado, "activa")
                )
            );
    };

    const convert = async (pedidoId: number, userId: number, tx?: Tx) => {
        await (tx ?? db)
            .update(reservationsTable)
            .set({ estado: "convertida", actualizada_en: new Date() })
            .where(
                and(
                    eq(reservationsTable.pedido_id, pedidoId),
                    eq(reservationsTable.user, userId),
                    eq(reservationsTable.estado, "activa")
                )
            );
    };

    return {
        getAvailability,
        reserve,
        release,
        convert,
        assertCanSell
    };
}

export type AvailabilityService = ReturnType<typeof createAvailabilityService>;
