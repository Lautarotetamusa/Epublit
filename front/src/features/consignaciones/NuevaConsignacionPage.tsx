import { useNavigate } from "react-router-dom";
import { Breadcrumb, Button, Card, Combobox, Field } from "../../design-system";
import { useConsignacionForm } from "./useConsignacionForm";
import { SeleccionLibrosField } from "../operaciones/SeleccionLibrosField";
import { useToast } from "../../notifications/ToastProvider";

export function NuevaConsignacionPage() {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const form = useConsignacionForm((consignacion) => {
        showToast("success", "Consignación registrada correctamente");
        navigate(`/consignaciones/${consignacion.id}`);
    });

    const handleSubmit = async () => {
        const error = await form.submit();
        if (error) showToast("error", error);
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <Breadcrumb
                items={["Consignaciones", "Nueva consignación"]}
                onNavigate={(_item, index) => index === 0 && navigate("/consignaciones")}
            />
            <Card title="Nueva consignación">
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
                        hint={<>El stock sale del depósito principal («{form.depositoPrincipal}»).</>}
                    />
                </div>

                <Button style={{ marginTop: "var(--space-5)" }} onClick={handleSubmit} loading={form.submitting}>
                    Registrar consignación
                </Button>
            </Card>
        </div>
    );
}
