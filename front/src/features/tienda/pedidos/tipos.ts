import type {
    EnvioPedido,
    EstadoPago,
    EstadoPedido,
    FormaEntrega,
    PedidoDetalle,
    PedidoResumen
} from "../../../api/tienda";

// Los tipos de datos salen del contrato real del backend (api/tienda.ts);
// acá viven sólo las reglas de presentación y la máquina de estados.
export type {
    EnvioPedido,
    EstadoPago,
    EstadoPedido,
    EventoSeguimiento,
    FormaEntrega,
    HistorialPedido,
    PedidoDetalle
} from "../../../api/tienda";

export type Pedido = PedidoResumen;

// Página pública de seguimiento e-commerce de Correo Argentino. No acepta el
// código por query param: el usuario entra y lo pega. Es el fallback cuando la
// API no devuelve un deep link propio.
export const URL_SEGUIMIENTO_CORREO = "https://www.correoargentino.com.ar/formularios/e-commerce";

// El estado del envío lo informa PAQ.AR y es independiente del estado del
// pedido: un pedido "enviado" puede estar en tránsito, en sucursal o demorado.
const ESTADO_ENVIO_LABEL: Record<string, string> = {
    en_preparacion: "En preparación",
    en_transito: "En tránsito",
    en_sucursal: "En sucursal",
    en_distribucion: "En distribución",
    entregado: "Entregado",
    demorado: "Demorado"
};

export function estadoEnvioLabel(estado: string | null): string {
    if (!estado) return "Sin estado informado";
    return ESTADO_ENVIO_LABEL[estado] ?? estado;
}

export type BadgeTone = "neutral" | "brand" | "accent" | "success" | "warning" | "error";

export function estadoEnvioTone(estado: string | null): BadgeTone {
    switch (estado) {
        case "en_preparacion":
            return "neutral";
        case "en_transito":
        case "en_sucursal":
        case "en_distribucion":
            return "brand";
        case "entregado":
            return "success";
        case "demorado":
            return "warning";
        default:
            return "neutral";
    }
}

// Única fuente para el destino de seguimiento: deep link del backend si
// existe, página pública de Correo Argentino si no.
export function urlDeSeguimiento(envio: Pick<EnvioPedido, "url"> | null): string {
    return envio?.url || URL_SEGUIMIENTO_CORREO;
}

// Orden del proceso: es el orden de las pestañas y el que sigue el historial.
export const ESTADOS_PEDIDO: EstadoPedido[] = [
    "pendiente_pago",
    "pagado",
    "aceptado",
    "enviado",
    "entregado",
    "rechazado",
    "cancelado"
];

export const ESTADO_PEDIDO_LABEL: Record<EstadoPedido, string> = {
    pendiente_pago: "Pendiente de pago",
    pagado: "Pagado",
    aceptado: "Aceptado",
    enviado: "Enviado",
    entregado: "Entregado",
    rechazado: "Rechazado",
    cancelado: "Cancelado"
};

export const ESTADO_PAGO_LABEL: Record<EstadoPago, string> = {
    pendiente: "Pago pendiente",
    aprobado: "Pago aprobado",
    rechazado: "Pago rechazado",
    reembolsado: "Reembolsado"
};

export function estadoPedidoTone(estado: EstadoPedido): BadgeTone {
    switch (estado) {
        case "pendiente_pago":
            return "warning";
        case "pagado":
            return "accent";
        case "aceptado":
            return "brand";
        case "enviado":
            return "brand";
        case "entregado":
            return "success";
        case "rechazado":
            return "error";
        case "cancelado":
            return "neutral";
    }
}

export function estadoPagoTone(estado: EstadoPago): BadgeTone {
    switch (estado) {
        case "pendiente":
            return "warning";
        case "aprobado":
            return "success";
        case "rechazado":
            return "error";
        case "reembolsado":
            return "neutral";
    }
}

export function formaEntregaLabel(forma: FormaEntrega): string {
    return forma === "envio" ? "Envío a domicilio" : "Retiro en local";
}

export function articulosLabel(cantidad: number): string {
    return cantidad === 1 ? "1 artículo" : `${cantidad.toLocaleString("es-AR")} artículos`;
}

export type AccionesPedido = {
    aceptar: boolean;
    rechazar: boolean;
    enviar: boolean;
    entregar: boolean;
};

// Qué se puede hacer en cada estado. Aceptar sólo después del pago aprobado
// (genera venta + Factura B); enviar sólo un pedido aceptado con envío;
// entregar un pedido enviado o, si es retiro en local, uno aceptado.
export function accionesDisponibles(pedido: Pick<PedidoDetalle, "estado" | "entrega">): AccionesPedido {
    switch (pedido.estado) {
        case "pendiente_pago":
            return { aceptar: false, rechazar: true, enviar: false, entregar: false };
        case "pagado":
            return { aceptar: true, rechazar: true, enviar: false, entregar: false };
        case "aceptado":
            return {
                aceptar: false,
                rechazar: false,
                enviar: pedido.entrega.tipo === "envio",
                entregar: pedido.entrega.tipo === "retiro"
            };
        case "enviado":
            return { aceptar: false, rechazar: false, enviar: false, entregar: true };
        default:
            return { aceptar: false, rechazar: false, enviar: false, entregar: false };
    }
}
