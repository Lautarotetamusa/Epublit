import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, Field, Button, Breadcrumb, Table, Badge, EmptyState } from "../../design-system";
import { useFichaCliente } from "./useFichaCliente";
import { FullscreenSpinner } from "../../components/FullscreenSpinner";
import { useToast } from "../../notifications/ToastProvider";
import { getErrorMessage } from "../../lib/errors";
import { TIPO_CLIENTE_LABEL, tipoClienteBadgeTone } from "./tipoCliente";
import { ClienteFormFields, isClienteFormValid } from "./ClienteFormFields";
import type { Cliente } from "../../api/cliente";

export function FichaClientePage() {
    const { id = "" } = useParams();
    const { cliente, stock, loading, syncing, update, syncPrecios } = useFichaCliente(Number(id));
    const { showToast } = useToast();
    const navigate = useNavigate();

    if (loading || !cliente || !stock) return <FullscreenSpinner />;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <Breadcrumb items={["Clientes", cliente.nombre]} onNavigate={(_item, index) => index === 0 && navigate("/clientes")} />
            <EdicionClienteForm
                key={cliente.id}
                cliente={cliente}
                onSave={async (input) => {
                    try {
                        await update(input);
                        showToast("success", "Cliente actualizado correctamente");
                    } catch (err) {
                        showToast("error", getErrorMessage(err));
                    }
                }}
            />
            <DatosImpositivosCard cliente={cliente} />
            <Card
                title="Libros en consignación"
                padded={false}
                actions={
                    stock.length > 0 ? (
                        <Button
                            variant="secondary"
                            size="sm"
                            loading={syncing}
                            onClick={async () => {
                                try {
                                    await syncPrecios();
                                    showToast("success", "Precios actualizados correctamente");
                                } catch (err) {
                                    showToast("error", getErrorMessage(err));
                                }
                            }}
                        >
                            Actualizar lista de precios
                        </Button>
                    ) : null
                }
            >
                <Table
                    columns={[
                        { header: "Título", key: "titulo" },
                        { header: "ISBN", key: "isbn", mono: true },
                        { header: "Stock", key: "stock", align: "right" },
                        { header: "Precio unit.", key: "precio", align: "right" }
                    ]}
                    rows={stock}
                    empty={<EmptyState icon="boxes" title="Este cliente no tiene libros en consignación" />}
                />
            </Card>
        </div>
    );
}

function DatosImpositivosCard({ cliente }: { cliente: Cliente }) {
    return (
        <Card title="Datos impositivos" subtitle="Se completan automáticamente desde AFIP a partir del CUIT">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: "var(--space-4)" }}>
                <Field label="Tipo">
                    <Badge tone={tipoClienteBadgeTone(cliente.tipo)}>{TIPO_CLIENTE_LABEL[cliente.tipo ?? ""] ?? "-"}</Badge>
                </Field>
                <Field label="Condición fiscal">
                    <span>{cliente.cond_fiscal || "-"}</span>
                </Field>
                <Field label="Razón social">
                    <span>{cliente.razon_social || "-"}</span>
                </Field>
            </div>
            <Field label="Domicilio" style={{ marginTop: "var(--space-4)" }}>
                <span>{cliente.domicilio || "-"}</span>
            </Field>
        </Card>
    );
}

function EdicionClienteForm({
    cliente,
    onSave
}: {
    cliente: Cliente;
    onSave: (input: { nombre: string; email?: string; cuit?: string }) => Promise<void>;
}) {
    const [inputs, setInputs] = useState({
        nombre: cliente.nombre,
        email: cliente.email ?? "",
        cuit: cliente.cuit ?? ""
    });
    const [saving, setSaving] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async () => {
        setSaving(true);
        await onSave({ nombre: inputs.nombre, email: inputs.email, cuit: inputs.cuit });
        setSaving(false);
    };

    return (
        <Card
            title={cliente.nombre}
            subtitle={cliente.cuit ? `CUIT ${cliente.cuit}` : undefined}
            actions={
                <Button
                    variant="secondary"
                    iconStart="receipt-text"
                    onClick={() => navigate(`/ventas/nueva?clienteId=${cliente.id}&tipoVenta=firme`)}
                >
                    Venta en firme
                </Button>
            }
        >
            <ClienteFormFields values={inputs} onChange={(patch) => setInputs((v) => ({ ...v, ...patch }))} />
            <Button style={{ marginTop: "var(--space-4)" }} onClick={handleSubmit} loading={saving} disabled={!isClienteFormValid(inputs)}>
                Guardar cambios
            </Button>
        </Card>
    );
}
