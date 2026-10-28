import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, Table, Badge, Breadcrumb, Button, EmptyState } from "../../design-system";
import { useToast } from "../../notifications/ToastProvider";
import { useFichaVenta } from "./useFichaVenta";
import { FullscreenSpinner } from "../../components/FullscreenSpinner";
import { ComprobantePanel } from "../comprobantes/ComprobantePanel";
import { useReintentarComprobante } from "../comprobantes/useComprobante";

export function FichaVentaPage() {
    const { id = "" } = useParams();
    const { venta, loading, error, refetch } = useFichaVenta(Number(id));
    const { reintentar, reintentando, error: errorReintento } = useReintentarComprobante(
        venta?.comprobante?.id ?? null,
        refetch
    );
    const { showToast } = useToast();
    const navigate = useNavigate();

    const reintentarFactura = async () => {
        const actualizado = await reintentar();
        if (actualizado) {
            showToast("success", "Factura emitida correctamente.");
        }
    };

    if (loading) return <FullscreenSpinner />;

    if (!venta) {
        return (
            <Card>
                <EmptyState
                    icon="receipt-text"
                    title="No pudimos cargar la venta"
                    description={error ?? "Puede que el enlace esté mal o que la venta ya no exista."}
                    action={<Button onClick={() => navigate("/ventas")}>Volver a ventas</Button>}
                />
            </Card>
        );
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <Breadcrumb items={["Ventas", `Venta #${venta.id}`]} onNavigate={(_item, index) => index === 0 && navigate("/ventas")} />

            <Card title={`Venta #${venta.id}`} subtitle={venta.nombre_cliente}>
                <dl style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--space-4)" }}>
                    <Detalle label="Tipo" value={venta.type === "venta" ? "En firme" : "Sobre consignado"} />
                    <Detalle label="CUIT" value={venta.cuit ?? "-"} />
                    <Detalle label="Medio de pago" value={venta.medio_pago.nombre} />
                    <Detalle label="Fecha" value={new Date(venta.fecha).toLocaleDateString("es-AR")} />
                    <Detalle label="Comisión (%)" value={`${venta.medio_pago.comision.toLocaleString("es-AR")}%`} />
                    <Detalle label="Neto" value={venta.neto.toLocaleString("es-AR")} />
                </dl>
            </Card>

            <Card title="Libros" padded={false}>
                <Table
                    columns={[
                        { header: "ISBN", key: "isbn", mono: true },
                        { header: "Título", key: "titulo" },
                        { header: "Cantidad", key: "cantidad", align: "right" },
                        { header: "Precio", align: "right", cell: (row) => row.precio.toLocaleString("es-AR") }
                    ]}
                    rows={venta.libros}
                />
                <div style={{ padding: "var(--space-4)", display: "flex", justifyContent: "flex-end" }}>
                    <Badge tone="brand">Total: {venta.total.toLocaleString("es-AR")}</Badge>
                </div>
            </Card>

            <Card title="Comprobante" subtitle="La factura o el remito asociado a la venta.">
                <ComprobantePanel
                    comprobante={venta.comprobante}
                    ventaId={venta.id}
                    onReintentar={reintentarFactura}
                    reintentando={reintentando}
                    errorReintento={errorReintento}
                />
            </Card>
        </div>
    );
}

function Detalle({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div>
            <dt style={{ fontSize: "var(--text-2xs)", textTransform: "uppercase", letterSpacing: "var(--tracking-caps)", color: "var(--text-muted)" }}>
                {label}
            </dt>
            <dd style={{ margin: "4px 0 0" }}>{value}</dd>
        </div>
    );
}
