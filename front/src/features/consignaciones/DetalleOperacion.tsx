import { Alert, Button, Table } from "../../design-system";
import type { OperacionDetalle } from "../../api/operaciones";
import { ComprobanteResumen } from "../comprobantes/ComprobanteResumen";
import { abrirComprobanteEnPestana, etiquetaVerComprobante } from "../comprobantes/formato";

// Detalle de una operación (consignación o devolución): los libros que movió y
// el remito emitido. Las operaciones viejas no tienen comprobante
// estructurado: se avisa sin ofrecer un reintento que no existe.
export function DetalleOperacion({ operacion }: { operacion: OperacionDetalle }) {
    const comprobante = operacion.comprobante;

    return (
        <>
            <Table
                columns={[
                    { header: "ISBN", key: "isbn", mono: true },
                    { header: "Título", key: "titulo" },
                    { header: "Cantidad", key: "cantidad", align: "right" }
                ]}
                rows={operacion.libros}
            />

            {comprobante ? (
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "var(--space-3)",
                        marginTop: "var(--space-4)"
                    }}
                >
                    <ComprobanteResumen comprobante={comprobante} />
                    <div>
                        <Button
                            variant="secondary"
                            iconStart="file-text"
                            onClick={() => abrirComprobanteEnPestana(comprobante.id)}
                        >
                            {etiquetaVerComprobante(comprobante)}
                        </Button>
                    </div>
                </div>
            ) : (
                <Alert tone="warning" title="Comprobante no disponible" style={{ marginTop: "var(--space-4)" }}>
                    Esta operación no tiene un remito estructurado. Las operaciones anteriores al
                    refactor no se pueden reimprimir.
                </Alert>
            )}
        </>
    );
}
