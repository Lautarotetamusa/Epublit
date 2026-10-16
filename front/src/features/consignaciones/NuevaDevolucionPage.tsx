import { useNavigate, useSearchParams } from "react-router-dom";
import { Breadcrumb, Button, Card, Combobox, Field } from "../../design-system";
import { useDevolucionForm } from "./useDevolucionForm";
import { SeleccionLibrosField } from "../operaciones/SeleccionLibrosField";
import { parsePrecargaOperacion } from "../../lib/precargaOperacion";
import { useToast } from "../../notifications/ToastProvider";

export function NuevaDevolucionPage() {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [searchParams] = useSearchParams();
    const form = useDevolucionForm(
        (devolucion) => {
            showToast("success", "Devolución registrada correctamente");
            navigate(`/devoluciones/${devolucion.id}`);
        },
        parsePrecargaOperacion(searchParams)
    );

    const handleSubmit = async () => {
        const error = await form.submit();
        if (error) showToast("error", error);
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <Breadcrumb
                items={["Devoluciones", "Nueva devolución"]}
                onNavigate={(_item, index) => index === 0 && navigate("/devoluciones")}
            />
            <Card title="Devolución de libros consignados">
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
                        disabled={form.clienteId === ""}
                        placeholder={form.clienteId === "" ? "Seleccioná un cliente" : "Seleccioná un libro"}
                    />
                </div>

                <Button style={{ marginTop: "var(--space-5)" }} onClick={handleSubmit} loading={form.submitting}>
                    Registrar devolución
                </Button>
            </Card>
        </div>
    );
}
