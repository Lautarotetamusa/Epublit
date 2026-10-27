import { Badge, Icon } from "../../../design-system";
import type { EstadoPago, EstadoPedido, FormaEntrega } from "./tipos";
import { ESTADO_PAGO_LABEL, ESTADO_PEDIDO_LABEL, estadoPagoTone, estadoPedidoTone } from "./tipos";

export function EstadoPedidoBadge({ estado }: { estado: EstadoPedido }) {
    return (
        <Badge tone={estadoPedidoTone(estado)} dot>
            {ESTADO_PEDIDO_LABEL[estado]}
        </Badge>
    );
}

export function EstadoPagoBadge({ estado }: { estado: EstadoPago }) {
    return (
        <Badge tone={estadoPagoTone(estado)} dot>
            {ESTADO_PAGO_LABEL[estado]}
        </Badge>
    );
}

// En la tabla el nombre completo ("Envío a domicilio") no entra sin empujar
// las otras columnas; el icono y la palabra corta alcanzan. En la ficha se
// usa `formaEntregaLabel`, que sí dice el modo completo.
export function FormaEntregaCelda({ forma }: { forma: FormaEntrega }) {
    const esEnvio = forma === "envio";
    return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
            <Icon name={esEnvio ? "truck" : "store"} size={14} color="var(--text-subtle)" />
            {esEnvio ? "Envío" : "Retiro"}
        </span>
    );
}
