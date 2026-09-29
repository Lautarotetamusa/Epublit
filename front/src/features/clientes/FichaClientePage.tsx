import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, Field, Button, Breadcrumb, Table, Badge, EmptyState } from "../../design-system";
import { useFichaCliente } from "./useFichaCliente";
import { FullscreenSpinner } from "../../components/FullscreenSpinner";
import { useToast } from "../../notifications/ToastProvider";
import { getErrorMessage } from "../../lib/errors";
import { TIPO_CLIENTE_LABEL, tipoClienteBadgeTone } from "./tipoCliente";
import { ClienteFormFields, isClienteFormValid } from "./ClienteFormFields";
import type { Cliente, StockCliente } from "../../api/cliente";

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
            {/* `key`: la selección pertenece a los libros de un cliente, no
                debe sobrevivir a un cambio de ficha sin desmontar. */}
            <LibrosConsignadosCard
                key={cliente.id}
                clienteId={cliente.id}
                stock={stock}
                syncing={syncing}
                onSyncPrecios={syncPrecios}
            />
        </div>
    );
}

function LibrosConsignadosCard({
    clienteId,
    stock,
    syncing,
    onSyncPrecios
}: {
    clienteId: number;
    stock: StockCliente[];
    syncing: boolean;
    onSyncPrecios: () => Promise<void>;
}) {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [selected, setSelected] = useState<Set<string | number>>(new Set());
    const isbnsSeleccionados = [...selected].join(",");

    const handleSyncPrecios = async () => {
        try {
            await onSyncPrecios();
            showToast("success", "Precios actualizados correctamente");
        } catch (err) {
            showToast("error", getErrorMessage(err));
        }
    };

    return (
        <Card
            title="Libros en consignación"
            padded={false}
            actions={
                stock.length > 0 ? (
                    <Button variant="secondary" size="sm" loading={syncing} onClick={handleSyncPrecios}>
                        Actualizar lista de precios
                    </Button>
                ) : null
            }
        >
            {selected.size > 0 ? (
                <BarraAccionesSeleccion
                    cantidad={selected.size}
                    onDevolucion={() => navigate(`/devoluciones?clienteId=${clienteId}&isbns=${isbnsSeleccionados}`)}
                    onVentaConsignacion={() =>
                        navigate(`/ventas/nueva?clienteId=${clienteId}&tipoVenta=consignacion&isbns=${isbnsSeleccionados}`)
                    }
                />
            ) : null}
            <Table
                selectable
                selectedKeys={selected}
                onSelectionChange={setSelected}
                rowKey={(s: StockCliente) => s.isbn}
                columns={[
                    { header: "Título", key: "titulo" },
                    { header: "ISBN", key: "isbn", mono: true },
                    { header: "Stock", key: "stock", align: "right", mono: true },
                    { header: "Precio unit.", align: "right", mono: true, cell: (s: StockCliente) => s.precio.toLocaleString("es-AR") }
                ]}
                rows={stock}
                empty={<EmptyState icon="boxes" title="Este cliente no tiene libros en consignación" />}
            />
        </Card>
    );
}

// Las dos operaciones posibles sobre los libros elegidos viven pegadas a la
// tabla (y no en las `actions` del Card, como en el catálogo) porque acá
// conviven con una acción de la lista completa ("Actualizar lista de precios")
// y son dos: mostrarlas en el header las apretaría contra el título y las
// alejaría del checkbox que las habilita.
function BarraAccionesSeleccion({
    cantidad,
    onDevolucion,
    onVentaConsignacion
}: {
    cantidad: number;
    onDevolucion: () => void;
    onVentaConsignacion: () => void;
}) {
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                justifyContent: "space-between",
                gap: "var(--space-4)",
                padding: "var(--space-3) var(--space-5)",
                background: "var(--surface-card)",
                borderBottom: "1px solid var(--border-subtle)"
            }}
        >
            <span aria-live="polite" style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                {cantidad === 1 ? "1 libro seleccionado" : `${cantidad} libros seleccionados`}
            </span>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
                <Button variant="secondary" size="sm" iconStart="truck" onClick={onDevolucion}>
                    Registrar devolución
                </Button>
                <Button variant="secondary" size="sm" iconStart="receipt-text" onClick={onVentaConsignacion}>
                    Venta sobre consignación
                </Button>
            </div>
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
