import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Button, Breadcrumb } from "../../design-system";
import { ClienteFormFields, isClienteFormValid } from "./ClienteFormFields";
import type { ClienteFormValues } from "./ClienteFormFields";
import { useNuevoCliente } from "./useNuevoCliente";
import { useToast } from "../../notifications/ToastProvider";
import { getErrorMessage } from "../../lib/errors";

export function NuevoClientePage() {
    const { saving, create } = useNuevoCliente();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const [inputs, setInputs] = useState<ClienteFormValues>({ nombre: "", email: "", cuit: "" });

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        try {
            const cliente = await create(inputs);
            showToast("success", "Cliente creado correctamente");
            navigate(`/clientes/${cliente.id}`);
        } catch (err) {
            showToast("error", getErrorMessage(err));
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <Breadcrumb items={["Clientes", "Nuevo cliente"]} onNavigate={(_item, index) => index === 0 && navigate("/clientes")} />
            <Card title="Nuevo cliente">
                <form onSubmit={handleSubmit}>
                    <ClienteFormFields values={inputs} onChange={(patch) => setInputs((v) => ({ ...v, ...patch }))} required />
                    <Button type="submit" style={{ marginTop: "var(--space-4)" }} loading={saving} disabled={!isClienteFormValid(inputs)}>
                        Guardar cliente
                    </Button>
                </form>
            </Card>
        </div>
    );
}
