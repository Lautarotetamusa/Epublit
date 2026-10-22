import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Breadcrumb, Button, Card, EmptyState } from "../../design-system";
import { deleteMedioPago } from "../../api/medioPago";
import { FullscreenSpinner } from "../../components/FullscreenSpinner";
import { useConfirm } from "../../notifications/ConfirmProvider";
import { useToast } from "../../notifications/ToastProvider";
import { getErrorMessage } from "../../lib/errors";
import { MedioPagoFormFields, comisionDeValor, isMedioPagoFormValid } from "./MedioPagoFormFields";
import type { MedioPagoFormValues } from "./MedioPagoFormFields";
import { useFichaMedioPago } from "./useFichaMedioPago";

export function FichaMedioPagoPage() {
    const { id = "" } = useParams();
    const { medio, loading, update } = useFichaMedioPago(Number(id));
    const { showToast } = useToast();
    const confirm = useConfirm();
    const navigate = useNavigate();

    if (loading) return <FullscreenSpinner />;

    if (!medio) {
        return (
            <Card>
                <EmptyState
                    icon="banknote"
                    title="El medio de pago no existe"
                    description="Puede que lo hayas dado de baja, o que el enlace esté mal."
                    action={<Button onClick={() => navigate("/medios-pago")}>Volver a medios de pago</Button>}
                />
            </Card>
        );
    }

    const handleBaja = async () => {
        const ok = await confirm({
            title: `¿Dar de baja «${medio.nombre}»?`,
            description: "Deja de estar disponible para vender. Las ventas ya hechas lo siguen mostrando.",
            confirmLabel: "Dar de baja",
            tone: "danger"
        });
        if (!ok) return;

        try {
            await deleteMedioPago(medio.id);
            showToast("success", "Medio de pago dado de baja correctamente");
            navigate("/medios-pago");
        } catch (err) {
            showToast("error", getErrorMessage(err));
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <Breadcrumb items={["Medios de pago", medio.nombre]} onNavigate={(_item, index) => index === 0 && navigate("/medios-pago")} />

            <EdicionMedioPagoForm
                key={medio.id}
                values={{ nombre: medio.nombre, comision: String(medio.comision) }}
                onSave={async (input) => {
                    try {
                        await update(input);
                        showToast("success", "Medio de pago actualizado correctamente");
                    } catch (err) {
                        showToast("error", getErrorMessage(err));
                    }
                }}
            />

            <Card title="Dar de baja">
                <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                    El medio deja de aparecer al registrar ventas, pero las ventas que ya lo usan siguen mostrando su nombre.
                </p>
                <div style={{ marginTop: "var(--space-4)" }}>
                    <Button variant="danger" onClick={handleBaja}>
                        Dar de baja
                    </Button>
                </div>
            </Card>
        </div>
    );
}

function EdicionMedioPagoForm({
    values: initial,
    onSave
}: {
    values: MedioPagoFormValues;
    onSave: (input: { nombre: string; comision: number }) => Promise<void>;
}) {
    const [values, setValues] = useState<MedioPagoFormValues>(initial);
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setSaving(true);
        await onSave({ nombre: values.nombre.trim(), comision: comisionDeValor(values.comision) });
        setSaving(false);
    };

    return (
        <Card title={initial.nombre} subtitle="Nombre y comisión del medio de pago.">
            <form onSubmit={handleSubmit}>
                <MedioPagoFormFields values={values} onChange={(patch) => setValues((actual) => ({ ...actual, ...patch }))} />
                <Button type="submit" style={{ marginTop: "var(--space-4)" }} loading={saving} disabled={!isMedioPagoFormValid(values)}>
                    Guardar cambios
                </Button>
            </form>
        </Card>
    );
}
