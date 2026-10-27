import { Database } from "../../../db/client";
import type { AvailabilityService } from "../stock/availability.service";
import type { PaymentRepository } from "../payment/payment.repository";
import type { OrderRepository } from "./order.repository";
import { PublicApiError } from "../shared/public.errors";

export type ExpirationServiceDeps = {
    db: Database;
    orderRepository: OrderRepository;
    paymentRepository: PaymentRepository;
    availabilityService: Pick<AvailabilityService, "release">;
};

export function createExpirationService({
    db,
    orderRepository,
    paymentRepository,
    availabilityService
}: ExpirationServiceDeps) {
    const cancel = async (userId: number, codigo: string) => {
        return db.transaction(async (tx) => {
            const pedido = await orderRepository.findByCode(userId, codigo, tx, true);
            if (pedido.estado !== "pendiente_pago") {
                throw new PublicApiError(
                    409,
                    "transicion_invalida",
                    "Sólo se puede cancelar un pedido pendiente de pago"
                );
            }

            const pago = await paymentRepository.findLatestForOrder(pedido.id, userId, tx);
            if (pago?.estado === "aprobado") {
                throw new PublicApiError(
                    409,
                    "transicion_invalida",
                    "El pedido ya tiene un pago aprobado"
                );
            }

            const actualizado = await orderRepository.updateOrder(
                userId,
                pedido.id,
                { estado: "cancelado", estado_pago: pago?.estado ?? "pendiente" },
                tx
            );

            await availabilityService.release(pedido.id, userId, tx);

            if (!(await orderRepository.hasHistory(pedido.id, userId, "pedido_cancelado", tx))) {
                await orderRepository.insertHistory(
                    pedido.id,
                    userId,
                    "pedido_cancelado",
                    "Pedido cancelado; reserva liberada",
                    tx
                );
            }

            return actualizado;
        });
    };

    // La expiración corre en transacción y bloquea el pedido: si el webhook de
    // pago ganó primero, el estado ya no es pendiente y no se cancela. Si la
    // expiración gana, el webhook posterior verá el pedido terminal y
    // disparará el reembolso.
    const expireOverdue = async (): Promise<number> => {
        const pendientes = await orderRepository.findOverduePending();
        let expirados = 0;

        for (const pendiente of pendientes) {
            const expirado = await db.transaction(async (tx) => {
                const pedido = await orderRepository.findByCode(
                    pendiente.user,
                    pendiente.codigo,
                    tx,
                    true
                );
                if (pedido.estado !== "pendiente_pago") return false;

                const pago = await paymentRepository.findLatestForOrder(pedido.id, pendiente.user, tx);
                if (pago?.estado === "aprobado") return false;

                await orderRepository.updateOrder(
                    pendiente.user,
                    pedido.id,
                    { estado: "cancelado", estado_pago: pago?.estado ?? "pendiente" },
                    tx
                );
                await availabilityService.release(pedido.id, pendiente.user, tx);

                if (
                    !(await orderRepository.hasHistory(
                        pedido.id,
                        pendiente.user,
                        "pedido_cancelado",
                        tx
                    ))
                ) {
                    await orderRepository.insertHistory(
                        pedido.id,
                        pendiente.user,
                        "pedido_cancelado",
                        "Pedido expirado a los 30 minutos; reserva liberada",
                        tx
                    );
                }

                return true;
            });

            if (expirado) expirados += 1;
        }

        return expirados;
    };

    return { cancel, expireOverdue };
}

export type ExpirationService = ReturnType<typeof createExpirationService>;

// En tests no se arranca el job: cada archivo controla la expiración llamando
// al servicio. En runtime queda desacoplado y no bloquea el cierre del proceso.
export function startTiendaExpirationJob(
    service: Pick<ExpirationService, "expireOverdue">,
    intervalMs = 60_000
): () => void {
    if (process.env.VITEST) return () => undefined;

    const timer = setInterval(() => {
        service.expireOverdue().catch((err: Error) => {
            console.error("Error expirando pedidos de la tienda:", err.message);
        });
    }, intervalMs);

    timer.unref();
    return () => clearInterval(timer);
}
