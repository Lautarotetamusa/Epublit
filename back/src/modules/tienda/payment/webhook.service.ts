import type { Database } from "../../../db/client";
import type { MercadoPagoClient, MercadoPagoPayment } from "./mercadopago.client";
import type { AvailabilityService } from "../stock/availability.service";
import type { MercadoPagoService } from "./mercadopago.service";
import type { PaymentStatus, PaymentRepository } from "./payment.repository";
import type { OrderRepository, OrderRow } from "../order/order.repository";
import { PublicApiError } from "../shared/public.errors";
import { isWebhookSignatureValid } from "./webhookSignature";
import type { WebhookRepository } from "./webhook.repository";

export type WebhookServiceDeps = {
    db: Database;
    orderRepository: OrderRepository;
    paymentRepository: PaymentRepository;
    webhookRepository: WebhookRepository;
    availabilityService: Pick<AvailabilityService, "release">;
    mercadoPagoService: Pick<
        MercadoPagoService,
        "getAccessTokenByMpUserId" | "getConnectionByMpUserId"
    >;
    mercadoPagoClient: Pick<MercadoPagoClient, "getPayment" | "refundPayment">;
    secret: string;
};

export type WebhookRequest = {
    signature: string | null;
    requestId: string | null;
    dataId: string | null;
    type: string | null;
    userId: string | null;
};

const paymentStatusByProvider: Partial<Record<string, PaymentStatus>> = {
    approved: "aprobado",
    rejected: "rechazado",
    cancelled: "rechazado",
    refunded: "reembolsado",
    charged_back: "reembolsado",
    pending: "pendiente",
    in_process: "pendiente",
    authorized: "pendiente"
};

const paymentStatus = (status: string): PaymentStatus => paymentStatusByProvider[status] ?? "pendiente";

const amountsMatch = (pedido: OrderRow, payment: MercadoPagoPayment): boolean => {
    if (Math.abs(payment.transaction_amount - pedido.total) > 0.01) return false;
    return payment.currency_id === pedido.moneda;
};


type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export function createWebhookService({
    db,
    orderRepository,
    paymentRepository,
    webhookRepository,
    availabilityService,
    mercadoPagoService,
    mercadoPagoClient,
    secret
}: WebhookServiceDeps) {
    const findOrderByReference = (
        externalReference: string | null | undefined,
        userId: number,
        tx: Transaction
    ) => {
        if (!externalReference) return Promise.resolve(null);
        return orderRepository.findByExternalReference(userId, externalReference, tx, true);
    };

    const registerPaymentAttempt = async (
        pedido: OrderRow,
        payment: MercadoPagoPayment,
        estado: PaymentStatus,
        tx: Transaction
    ) => {
        const datos = payment as Record<string, unknown>;
        const fechaPago = payment.date_approved ? new Date(payment.date_approved) : null;
        const existente = await paymentRepository.findByPagoId(payment.id, tx);
        const importe = payment.transaction_amount;

        if (existente) {
            await paymentRepository.update(
                existente.id,
                existente.user,
                { estado, importe, fecha_pago: fechaPago, datos },
                tx
            );
            return;
        }

        const ultimo = await paymentRepository.findLatestForOrder(pedido.id, pedido.user, tx);
        if (ultimo && !ultimo.pago_id) {
            await paymentRepository.update(
                ultimo.id,
                pedido.user,
                { pago_id: payment.id, estado, importe, fecha_pago: fechaPago, datos },
                tx
            );
            return;
        }

        await paymentRepository.insert(
            {
                user: pedido.user,
                pedido_id: pedido.id,
                proveedor: "mercadopago",
                pago_id: payment.id,
                preferencia_id: ultimo?.preferencia_id ?? null,
                estado,
                importe,
                moneda: payment.currency_id,
                fecha_pago: fechaPago,
                datos
            },
            tx
        );
    };

    const cancelOrder = async (pedido: OrderRow, finalPaymentStatus: PaymentStatus, tx: Transaction) => {
        await orderRepository.updateOrder(
            pedido.user,
            pedido.id,
            { estado: "cancelado", estado_pago: finalPaymentStatus },
            tx
        );
        await availabilityService.release(pedido.id, pedido.user, tx);
        await orderRepository.insertHistory(
            pedido.id,
            pedido.user,
            "pedido_cancelado",
            "Pedido cancelado",
            tx
        );
    };

    const refundUnexpectedPayment = async (
        pedido: OrderRow,
        payment: MercadoPagoPayment,
        accessToken: string,
        motivo: string,
        tx: Transaction
    ): Promise<boolean> => {
        const refunded = await mercadoPagoClient.refundPayment(accessToken, payment.id).then(
            () => true,
            () => false
        );

        await registerPaymentAttempt(pedido, payment, refunded ? "reembolsado" : "aprobado", tx);
        await orderRepository.insertHistory(
            pedido.id,
            pedido.user,
            refunded ? "pago_reembolsado" : "pago_aprobado_terminal",
            refunded ? `${motivo}; se registró el reembolso` : `${motivo}; falló el reembolso`,
            tx
        );
        return refunded;
    };

    const refundLatePayment = async (
        pedido: OrderRow,
        payment: MercadoPagoPayment,
        accessToken: string,
        tx: Transaction
    ) => {
        const refunded = await refundUnexpectedPayment(pedido, payment, accessToken, "Pago aprobado fuera de tiempo", tx);
        await orderRepository.updateOrder(
            pedido.user,
            pedido.id,
            refunded
                ? { estado_pago: "reembolsado", detalle_rechazo: "Pago aprobado después de un estado terminal; reembolsado" }
                : { estado_pago: "aprobado" },
            tx
        );
    };

    // Una preferencia de Checkout Pro acepta más de un pago (dos pestañas, o
    // el link viejo después de regenerarlo): un segundo pago aprobado sobre un
    // pedido ya pagado se devuelve para no cobrarle doble al comprador.
    const isDuplicatePayment = async (pedido: OrderRow, payment: MercadoPagoPayment, tx: Transaction) => {
        if (pedido.estado_pago !== "aprobado") return false;
        const registrado = await paymentRepository.findByPagoId(payment.id, tx);
        return registrado?.estado !== "aprobado";
    };

    const processApprovedPayment = async (
        pedido: OrderRow,
        payment: MercadoPagoPayment,
        accessToken: string,
        tx: Transaction
    ) => {
        if (["cancelado", "rechazado", "entregado"].includes(pedido.estado)) {
            return refundLatePayment(pedido, payment, accessToken, tx);
        }
        if (await isDuplicatePayment(pedido, payment, tx)) {
            await refundUnexpectedPayment(pedido, payment, accessToken, "Pago duplicado de un pedido ya pagado", tx);
            return;
        }

        await registerPaymentAttempt(pedido, payment, "aprobado", tx);

        if (pedido.estado === "pendiente_pago") {
            await orderRepository.updateOrder(
                pedido.user,
                pedido.id,
                { estado: "pagado", estado_pago: "aprobado" },
                tx
            );
            await orderRepository.insertHistory(
                pedido.id,
                pedido.user,
                "pago_aprobado",
                "Pago aprobado por MercadoPago",
                tx
            );
        } else {
            await orderRepository.updateOrder(
                pedido.user,
                pedido.id,
                { estado_pago: "aprobado" },
                tx
            );
        }
    };

    const processRejectedPayment = async (
        pedido: OrderRow,
        payment: MercadoPagoPayment,
        tx: Transaction
    ) => {
        await registerPaymentAttempt(pedido, payment, "rechazado", tx);
        await orderRepository.updateOrder(
            pedido.user,
            pedido.id,
            { estado_pago: "rechazado" },
            tx
        );
        await orderRepository.insertHistory(
            pedido.id,
            pedido.user,
            "pago_rechazado",
            "Pago rechazado por MercadoPago",
            tx
        );
    };

    const processRefund = async (
        pedido: OrderRow,
        payment: MercadoPagoPayment,
        tx: Transaction
    ) => {
        await registerPaymentAttempt(pedido, payment, "reembolsado", tx);

        if (pedido.estado === "pendiente_pago" || pedido.estado === "pagado") {
            await cancelOrder(pedido, "reembolsado", tx);
        } else {
            await orderRepository.updateOrder(
                pedido.user,
                pedido.id,
                { estado_pago: "reembolsado" },
                tx
            );
        }

        await orderRepository.insertHistory(
            pedido.id,
            pedido.user,
            "pago_reembolsado",
            "Pago reembolsado por MercadoPago",
            tx
        );
    };

    const process = async (input: WebhookRequest) => {
        // MercadoPago también manda IPN legacy (`?topic=...&id=...`) sin firma
        // verificable. Se ignoran con 200 antes de validar la firma: si se
        // rechazan, MP las reintenta indefinidamente, y el pago ya se procesa
        // por la notificación `type=payment`.
        if (input.type !== "payment" || !input.dataId || !input.userId) {
            return { ok: true };
        }

        if (
            !isWebhookSignatureValid({
                secret,
                signature: input.signature,
                requestId: input.requestId,
                dataId: input.dataId
            })
        ) {
            throw new PublicApiError(401, "no_autenticado", "Firma de webhook inválida");
        }

        // Sin conexión se responde error para que MP reintente: si la editorial
        // reconecta, el pago todavía se procesa en vez de perderse.
        const connection = await mercadoPagoService.getConnectionByMpUserId(input.userId);
        if (!connection) {
            throw new PublicApiError(409, "mercadopago_no_conectado", "MercadoPago no está conectado");
        }

        let accessToken: string;
        let payment: MercadoPagoPayment;
        try {
            accessToken = await mercadoPagoService.getAccessTokenByMpUserId(connection.mp_user_id);
            payment = await mercadoPagoClient.getPayment(accessToken, input.dataId);
        } catch {
            throw new PublicApiError(502, "proveedor_no_disponible", "MercadoPago no respondió");
        }

        // `user_id` viene del query y no entra en la firma: sin este chequeo un
        // request firmado reenviado con otro `user_id` haría procesar un pago
        // ajeno con el token de esa conexión.
        if (payment.collector_id !== connection.mp_user_id) {
            return { ok: true, ignorado: "otro_vendedor" };
        }

        const eventoId = `${payment.id}:${payment.status}`;

        return db.transaction(async (tx) => {
            const eventoInsertado = await webhookRepository.insertEvent(
                {
                    proveedor: "mercadopago",
                    eventoId,
                    tipo: input.type,
                    payload: payment,
                    user: connection.user
                },
                tx
            );

            if (eventoInsertado === null) return { ok: true, repetido: true };

            const pedido = await findOrderByReference(payment.external_reference, connection.user, tx);

            if (!pedido) {
                await webhookRepository.markProcessed(eventoInsertado, connection.user, tx);
                return { ok: true };
            }

            if (!amountsMatch(pedido, payment)) {
                // El evento queda registrado, pero no se toca el pedido ni el
                // intento de pago: un importe ajeno no debe bloquear reintentos.
                await webhookRepository.markProcessed(eventoInsertado, connection.user, tx);
                return { ok: true, ignorado: "importe_o_moneda" };
            }

            const estado = paymentStatus(payment.status);
            if (estado === "aprobado") {
                await processApprovedPayment(pedido, payment, accessToken, tx);
            } else if (estado === "rechazado") {
                await processRejectedPayment(pedido, payment, tx);
            } else if (estado === "reembolsado") {
                await processRefund(pedido, payment, tx);
            } else {
                await registerPaymentAttempt(pedido, payment, "pendiente", tx);
            }

            await webhookRepository.markProcessed(eventoInsertado, connection.user, tx);
            return { ok: true };
        });
    };

    return { process };
}

export type WebhookService = ReturnType<typeof createWebhookService>;
