import { Badge } from "../../design-system";
import type { ComprobanteEstado, ComprobanteResumen as ComprobanteResumenDTO } from "../../api/comprobantes";
import {
    ESTADO_COMPROBANTE_LABEL,
    estadoComprobanteTone,
    formatearFechaComprobante,
    nombreComprobante
} from "./formato";
import "./comprobante.css";

export function EstadoComprobanteBadge({ estado }: { estado: ComprobanteEstado }) {
    const icono = estado === "emitida" ? "check" : estado === "error" ? "circle-alert" : undefined;

    return (
        <Badge tone={estadoComprobanteTone(estado)} icon={icono} dot={icono === undefined}>
            {ESTADO_COMPROBANTE_LABEL[estado]}
        </Badge>
    );
}

// Resumen que ya viene en los detalles: sirve para la ficha aunque todavía no
// se haya pedido el DTO completo (y no dispara ningún fetch).
export function ComprobanteResumen({
    comprobante,
    ventaId
}: {
    comprobante: ComprobanteResumenDTO;
    ventaId?: number | null;
}) {
    return (
        <dl className="comprobante-resumen" aria-label="Datos del comprobante">
            <div>
                <dt>Comprobante</dt>
                <dd>{nombreComprobante(comprobante)}</dd>
            </div>
            <div>
                <dt>Número</dt>
                <dd className="comprobante-resumen-mono">{comprobante.numeroCompleto ?? "—"}</dd>
            </div>
            <div>
                <dt>Fecha</dt>
                <dd>{formatearFechaComprobante(comprobante.fecha)}</dd>
            </div>
            <div>
                <dt>Estado</dt>
                <dd>
                    <EstadoComprobanteBadge estado={comprobante.estado} />
                </dd>
            </div>
            {ventaId ? (
                <div>
                    <dt>Venta</dt>
                    <dd className="comprobante-resumen-mono">#{ventaId}</dd>
                </div>
            ) : null}
        </dl>
    );
}
