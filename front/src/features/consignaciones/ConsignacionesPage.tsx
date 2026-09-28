import { useEffect, useState } from "react";
import { Card, Table, Pagination, Combobox, Field, Button, Dialog, EmptyState } from "../../design-system";
import type { Operacion, OperacionDetalle } from "../../api/operaciones";
import { getConsignacion } from "../../api/operaciones";
import { useConsignaciones } from "./useConsignaciones";
import { useConsignacionForm } from "./useConsignacionForm";
import { SeleccionLibrosField } from "../operaciones/SeleccionLibrosField";
import { useClientPagination } from "../../lib/useClientPagination";
import { useToast } from "../../notifications/ToastProvider";

export function ConsignacionesPage() {
    const { consignaciones, loading, refetch } = useConsignaciones();
    const { page, setPage, pageCount, pageItems, total } = useClientPagination(consignaciones);
    const [detalleId, setDetalleId] = useState<number | null>(null);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <Card title="Alta de consignaciones">
                <NuevaConsignacionForm onCreated={refetch} />
            </Card>

            <Card title="Consignaciones" padded={false}>
                <Table
                    columns={[
                        { header: "ID", key: "id" },
                        { header: "Cliente", key: "nombre_cliente" },
                        { header: "CUIT", key: "cuit", mono: true },
                        { header: "Fecha", cell: (row: Operacion) => new Date(row.fecha).toLocaleDateString("es-AR") }
                    ]}
                    rows={pageItems}
                    onRowClick={(row: Operacion) => setDetalleId(row.id)}
                    empty={loading ? "Cargando..." : <EmptyState icon="boxes" title="Todavía no hay consignaciones" />}
                />
                {total > 0 ? (
                    <div style={{ padding: "var(--space-4)" }}>
                        <Pagination page={page} pageCount={pageCount} total={total} onChange={setPage} />
                    </div>
                ) : null}
            </Card>

            {detalleId !== null ? <ConsignacionDetalleDialog id={detalleId} onClose={() => setDetalleId(null)} /> : null}
        </div>
    );
}

function NuevaConsignacionForm({ onCreated }: { onCreated: () => void }) {
    const { showToast } = useToast();
    const form = useConsignacionForm(() => {
        showToast("success", "Consignación registrada correctamente");
        onCreated();
    });

    const handleSubmit = async () => {
        const error = await form.submit();
        if (error) showToast("error", error);
    };

    return (
        <div>
            <Field label="Cliente" required style={{ maxWidth: 360 }}>
                <Combobox
                    value={form.clienteId === "" ? "" : String(form.clienteId)}
                    onChange={(value) => form.setClienteId(value === "" ? "" : Number(value))}
                    options={form.clientes.map((c) => ({ value: String(c.id), label: c.nombre }))}
                    placeholder="Buscá un cliente"
                    emptyMessage="No se encontraron clientes"
                />
            </Field>

            <div style={{ marginTop: "var(--space-5)" }}>
                <SeleccionLibrosField
                    librosDisponibles={form.librosDisponibles}
                    seleccionados={form.seleccionados}
                    onAgregar={form.agregar}
                    onActualizarCantidad={form.actualizar}
                    onQuitar={form.quitar}
                />
            </div>

            <Button style={{ marginTop: "var(--space-5)" }} onClick={handleSubmit} loading={form.submitting}>
                Registrar consignación
            </Button>
        </div>
    );
}

function ConsignacionDetalleDialog({ id, onClose }: { id: number; onClose: () => void }) {
    const [detalle, setDetalle] = useState<OperacionDetalle | null>(null);

    useEffect(() => {
        getConsignacion(id).then((r) => setDetalle(r.data));
    }, [id]);

    return (
        <Dialog open title="Detalle de la consignación" onClose={onClose} width={640}>
            {detalle === null ? (
                "Cargando..."
            ) : (
                <>
                    <Table
                        columns={[
                            { header: "ISBN", key: "isbn", mono: true },
                            { header: "Título", key: "titulo" },
                            { header: "Cantidad", key: "cantidad", align: "right" }
                        ]}
                        rows={detalle.libros}
                    />
                    {detalle.file_path ? (
                        <div style={{ marginTop: "var(--space-4)" }}>
                            <Button variant="secondary" iconStart="file-text" onClick={() => window.open(detalle.file_path, "_blank")}>
                                Ver remito
                            </Button>
                        </div>
                    ) : null}
                </>
            )}
        </Dialog>
    );
}
