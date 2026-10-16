import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Breadcrumb, Button, Card } from "../../design-system";
import { useToast } from "../../notifications/ToastProvider";
import { getErrorMessage } from "../../lib/errors";
import { MedioPagoFormFields, comisionDeValor, isMedioPagoFormValid } from "./MedioPagoFormFields";
import type { MedioPagoFormValues } from "./MedioPagoFormFields";
import { useNuevoMedioPago } from "./useNuevoMedioPago";

export function NuevoMedioPagoPage() {
    const { saving, create } = useNuevoMedioPago();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const [values, setValues] = useState<MedioPagoFormValues>({ nombre: "", comision: "0" });

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        try {
            const medio = await create({ nombre: values.nombre.trim(), comision: comisionDeValor(values.comision) });
            showToast("success", "Medio de pago creado correctamente");
            navigate(`/medios-pago/${medio.id}`);
        } catch (err) {
            showToast("error", getErrorMessage(err));
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <Breadcrumb items={["Medios de pago", "Nuevo medio de pago"]} onNavigate={(_item, index) => index === 0 && navigate("/medios-pago")} />
            <Card title="Nuevo medio de pago" subtitle="La comisión se descuenta del total al registrar una venta.">
                <form onSubmit={handleSubmit}>
                    <MedioPagoFormFields values={values} onChange={(patch) => setValues((actual) => ({ ...actual, ...patch }))} />
                    <Button type="submit" style={{ marginTop: "var(--space-4)" }} loading={saving} disabled={!isMedioPagoFormValid(values)}>
                        Guardar medio de pago
                    </Button>
                </form>
            </Card>
        </div>
    );
}
