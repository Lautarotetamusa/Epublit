import { Alert, Button, EmptyState } from "../../design-system";
import type { ComprobanteResumen as ComprobanteResumenDTO } from "../../api/comprobantes";
import { ComprobantePreview } from "./ComprobantePreview";
import { ComprobanteResumen } from "./ComprobanteResumen";
import "./comprobante.css";

type ComprobantePanelProps = {
    comprobante: ComprobanteResumenDTO | null;
    ventaId?: number | null;
    onReintentar?: () => void | Promise<void>;
    reintentando?: boolean;
    errorReintento?: string | null;
    descripcionVacio?: string;
};

// Bloque de comprobante para la ficha de venta: resumen, estados de emisión,
// reintento y preview inline. Las fichas con otra lógica de reintento (por
// ejemplo el pedido, que usa `/pedidos/:codigo/facturar`) componen el resumen
// y el preview por separado.
export function ComprobantePanel({
    comprobante,
    ventaId,
    onReintentar,
    reintentando = false,
    errorReintento,
    descripcionVacio
}: ComprobantePanelProps) {
    if (!comprobante) {
        return (
            <EmptyState
                icon="file-text"
                title="Comprobante no disponible"
                description={
                    descripcionVacio ??
                    "Esta operación no tiene un comprobante estructurado. Las operaciones anteriores al refactor no se pueden reimprimir."
                }
                style={{
                    padding: "var(--space-2) 0 0",
                    alignItems: "flex-start",
                    textAlign: "left",
                    gap: "var(--space-2)"
                }}
            />
        );
    }

    const puedeReintentar =
        comprobante.clase === "factura" &&
        (comprobante.estado === "pendiente" || comprobante.estado === "error");

    return (
        <div className="comprobante-panel">
            <ComprobanteResumen comprobante={comprobante} ventaId={ventaId} />

            {comprobante.estado === "pendiente" ? (
                <Alert tone="warning" title="Factura pendiente de emisión">
                    AFIP todavía no autorizó la factura. La venta ya está registrada y podés
                    reintentar la emisión.
                </Alert>
            ) : null}

            {comprobante.estado === "error" ? (
                <Alert tone="error" title="AFIP no emitió la factura">
                    La venta y el movimiento quedaron registrados. Podés reintentar la emisión
                    sin duplicar la operación.
                </Alert>
            ) : null}

            {puedeReintentar && onReintentar ? (
                <div className="comprobante-panel-acciones">
                    <Button
                        variant="secondary"
                        size="sm"
                        iconStart="receipt-text"
                        onClick={onReintentar}
                        loading={reintentando}
                    >
                        Reintentar factura
                    </Button>
                </div>
            ) : null}

            {errorReintento ? (
                <Alert tone="error" title="No se pudo reintentar la factura">
                    {errorReintento}
                </Alert>
            ) : null}

            {comprobante.estado === "emitida" ? (
                <div className="comprobante-panel-preview">
                    <ComprobantePreview comprobante={comprobante} />
                </div>
            ) : null}
        </div>
    );
}
