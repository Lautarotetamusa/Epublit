import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Breadcrumb, Button, Card } from "../../design-system";
import { createDeposito } from "../../api/deposito";
import { useToast } from "../../notifications/ToastProvider";
import { getErrorMessage } from "../../lib/errors";
import type { DepositoFormValues } from "./DepositoFormFields";
import { DepositoFormFields, isDepositoFormValid } from "./DepositoFormFields";

export function NuevoDepositoPage() {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [values, setValues] = useState<DepositoFormValues>({ nombre: "", descripcion: "" });
    const [saving, setSaving] = useState(false);

    const handleCrear = async () => {
        setSaving(true);
        try {
            const response = await createDeposito({
                nombre: values.nombre,
                descripcion: values.descripcion.trim() ? values.descripcion : null
            });
            showToast("success", "Depósito creado correctamente");
            navigate(`/depositos/${response.data.id}`);
        } catch (err) {
            showToast("error", getErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <Breadcrumb
                items={["Depósitos", "Nuevo depósito"]}
                onNavigate={(_item, index) => index === 0 && navigate("/depositos")}
            />
            <Card
                title="Nuevo depósito"
                subtitle="Un depósito es un lugar donde tenés libros. El principal se crea con tu cuenta y no se puede eliminar."
            >
                <DepositoFormFields values={values} onChange={(patch) => setValues((actual) => ({ ...actual, ...patch }))} />
                <Button
                    style={{ marginTop: "var(--space-4)" }}
                    onClick={handleCrear}
                    loading={saving}
                    disabled={!isDepositoFormValid(values)}
                >
                    Crear depósito
                </Button>
            </Card>
        </div>
    );
}
