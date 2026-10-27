import type { PaymentStatus, PaymentRow } from "../payment/payment.repository";
import type { OrderItemRow, OrderRow } from "./order.repository";

type PublicShipping = {
    codigo: string | null;
    estado: string | null;
    urlSeguimiento: string | null;
};

export type PublicPayment = {
    proveedor: string;
    estado: PaymentStatus;
    preferenciaId: string | null;
    initPoint: string | null;
};

const publicDelivery = (pedido: OrderRow) => {
    if (pedido.entrega_tipo === "retiro") {
        return {
            tipo: "retiro" as const,
            direccion: pedido.retiro_direccion,
            horario: pedido.retiro_horario
        };
    }

    return {
        tipo: "envio" as const,
        direccion: {
            calle: pedido.entrega_calle,
            numero: pedido.entrega_numero,
            piso: pedido.entrega_piso,
            depto: pedido.entrega_depto,
            localidad: pedido.entrega_localidad,
            provincia: pedido.entrega_provincia,
            codigoPostal: pedido.entrega_codigo_postal
        }
    };
};

export const toPaymentSummary = (pago: PaymentRow | null, pedido: OrderRow): PublicPayment => {
    if (!pago) {
        return {
            proveedor: "mercadopago",
            estado: pedido.estado_pago,
            preferenciaId: null,
            initPoint: null
        };
    }

    return {
        proveedor: pago.proveedor,
        estado: pago.estado,
        preferenciaId: pago.preferencia_id,
        initPoint: pago.init_point
    };
};

export const toPublicOrder = (
    pedido: OrderRow,
    items: OrderItemRow[],
    pago: PublicPayment,
    envio?: PublicShipping | null
) => {
    const publico = {
        codigo: pedido.codigo,
        referencia: pedido.referencia_externa,
        estado: pedido.estado,
        estadoPago: pedido.estado_pago,
        fecha: pedido.creado_en,
        items: items.map((item) => ({
            isbn: item.isbn,
            titulo: item.titulo,
            cantidad: item.cantidad,
            precioUnitario: item.precio_unitario,
            subtotal: item.subtotal
        })),
        subtotal: pedido.subtotal,
        costoEnvio: pedido.costo_envio,
        total: pedido.total,
        entrega: publicDelivery(pedido),
        pago
    };

    if (!envio) return publico;

    return {
        ...publico,
        envio: {
            codigo: envio.codigo,
            estado: envio.estado,
            urlSeguimiento: envio.urlSeguimiento
        }
    };
};
