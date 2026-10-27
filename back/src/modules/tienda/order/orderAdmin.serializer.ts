import type { PaymentRow } from "../payment/payment.repository";
import type { OrderSummaryRow } from "./orderAdmin.repository";
import type { OrderHistoryRow, OrderItemRow, OrderRow } from "./order.repository";
import type { ShipmentEventRow, ShipmentRow } from "../shipping/shipment.repository";
import { toShippingBlock } from "../shipping/shipment.serializer";
import type { VentaRow } from "../../transaccion/venta.validator";

export function toOrderSummary(row: OrderSummaryRow) {
    return {
        codigo: row.codigo,
        fecha: row.creado_en,
        comprador: {
            nombre: row.comprador_nombre,
            email: row.comprador_email,
            telefono: row.comprador_telefono
        },
        total: row.total,
        estadoPago: row.estado_pago,
        entrega: row.entrega_tipo,
        estado: row.estado,
        cantidadItems: row.cantidad_items
    };
}

const deliveryBlock = (pedido: OrderRow) => {
    if (pedido.entrega_tipo === "retiro") {
        return {
            tipo: "retiro" as const,
            punto: pedido.retiro_direccion,
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
        },
        costoEnvio: pedido.costo_envio
    };
};

const boxBlock = (pedido: OrderRow) => {
    if (
        pedido.caja_alto_cm === null &&
        pedido.caja_ancho_cm === null &&
        pedido.caja_largo_cm === null
    ) {
        return null;
    }

    return {
        altoCm: pedido.caja_alto_cm,
        anchoCm: pedido.caja_ancho_cm,
        largoCm: pedido.caja_largo_cm
    };
};

const saleBlock = (venta: VentaRow | null) => {
    if (!venta) return null;

    return {
        id: venta.id_movimiento,
        total: venta.total,
        tipoCbte: venta.tipo_cbte,
        medioPagoId: venta.id_medio_pago
    };
};

const paymentBlock = (pago: PaymentRow | null, pedido: OrderRow) => {
    if (!pago) {
        return {
            proveedor: "mercadopago",
            estado: pedido.estado_pago,
            idOperacion: null,
            importe: pedido.total,
            moneda: pedido.moneda,
            fecha: null
        };
    }

    return {
        proveedor: pago.proveedor,
        estado: pago.estado,
        idOperacion: pago.pago_id,
        importe: pago.importe,
        moneda: pago.moneda,
        fecha: pago.fecha_pago ?? pago.creado_en
    };
};

export type OrderDetailData = {
    pedido: OrderRow;
    items: OrderItemRow[];
    historial: OrderHistoryRow[];
    pago: PaymentRow | null;
    envio: ShipmentRow | null;
    envioEventos: ShipmentEventRow[];
    venta: VentaRow | null;
};

export function toOrderDetail({
    pedido,
    items,
    historial,
    pago,
    envio,
    envioEventos,
    venta
}: OrderDetailData) {
    return {
        codigo: pedido.codigo,
        fecha: pedido.creado_en,
        actualizadoEn: pedido.actualizado_en,
        estado: pedido.estado,
        estadoPago: pedido.estado_pago,
        comprador: {
            nombre: pedido.comprador_nombre,
            email: pedido.comprador_email,
            telefono: pedido.comprador_telefono,
            documento: pedido.comprador_documento
        },
        entrega: deliveryBlock(pedido),
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
        pesoKg: pedido.peso_kg,
        caja: boxBlock(pedido),
        pago: paymentBlock(pago, pedido),
        envio:
            pedido.entrega_tipo === "retiro"
                ? null
                : toShippingBlock(pedido.codigo, envio, envioEventos),
        venta: saleBlock(venta),
        comprobante: {
            estado: pedido.comprobante_estado,
            tipo: pedido.comprobante_tipo,
            numero: pedido.comprobante_numero,
            fecha: pedido.comprobante_fecha,
            archivoUrl: pedido.comprobante_file_path
                ? `/pedidos/${pedido.codigo}/comprobante`
                : null
        },
        motivoRechazo: pedido.motivo_rechazo,
        detalleRechazo: pedido.detalle_rechazo,
        historial: historial.map((hito) => ({
            tipo: hito.tipo,
            descripcion: hito.descripcion,
            fecha: hito.fecha
        }))
    };
}
