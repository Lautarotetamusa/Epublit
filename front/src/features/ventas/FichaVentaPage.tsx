import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, Table, Badge, Breadcrumb, Button, EmptyState } from "../../design-system";
import { useFichaVenta } from "./useFichaVenta";
import { FullscreenSpinner } from "../../components/FullscreenSpinner";

export function FichaVentaPage() {
    const { id = "" } = useParams();
    const { venta, loading } = useFichaVenta(Number(id));
    const navigate = useNavigate();

    if (loading || !venta) return <FullscreenSpinner />;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <Breadcrumb items={["Ventas", `Venta #${venta.id}`]} onNavigate={(_item, index) => index === 0 && navigate("/ventas")} />

            <Card title={`Venta #${venta.id}`} subtitle={venta.nombre_cliente}>
                <dl style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--space-4)" }}>
                    <Detalle label="Tipo" value={venta.type === "venta" ? "En firme" : "Sobre consignado"} />
                    <Detalle label="CUIT" value={venta.cuit ?? "-"} />
                    <Detalle label="Medio de pago" value={venta.medio_pago} />
                    <Detalle label="Fecha" value={new Date(venta.fecha).toLocaleDateString("es-AR")} />
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

            <Card
                title="Factura"
                actions={
                    venta.file_path ? (
                        <Button
                            variant="secondary"
                            size="sm"
                            iconStart="external-link"
                            onClick={() => window.open(venta.file_path, "_blank")}
                        >
                            Abrir en pestaña nueva
                        </Button>
                    ) : null
                }
            >
                {venta.file_path ? (
                    <iframe
                        title="Factura"
                        src={venta.file_path}
                        style={{ width: "100%", height: 640, border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)" }}
                    />
                ) : (
                    <EmptyState icon="file-text" title="Todavía no se generó la factura" />
                )}
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
