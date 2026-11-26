import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Breadcrumb, Button, Card } from "../../design-system";
import { useToast } from "../../notifications/ToastProvider";
import { getErrorMessage } from "../../lib/errors";
import { TipoEdicionFormFields, isTipoEdicionFormValid } from "./TipoEdicionFormFields";
import type { TipoEdicionFormValues } from "./TipoEdicionFormFields";
import { useNuevoTipoEdicion } from "./useNuevoTipoEdicion";

export function NuevoTipoEdicionPage() {
    const { saving, create } = useNuevoTipoEdicion();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const [values, setValues] = useState<TipoEdicionFormValues>({ nombre: "" });

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        try {
            const tipo = await create({ nombre: values.nombre.trim() });
            showToast("success", "Tipo de edición creado");
            navigate(`/tipos-edicion/${tipo.id}`);
        } catch (err) {
            showToast("error", getErrorMessage(err));
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <Breadcrumb
                items={["Tipos de edición", "Nuevo tipo de edición"]}
                onNavigate={(_item, index) => index === 0 && navigate("/tipos-edicion")}
            />
            <Card title="Nuevo tipo de edición">
                <form onSubmit={handleSubmit}>
                    <TipoEdicionFormFields values={values} onChange={(patch) => setValues((current) => ({ ...current, ...patch }))} />
                    <Button type="submit" style={{ marginTop: "var(--space-4)" }} loading={saving} disabled={!isTipoEdicionFormValid(values)}>
                        Guardar tipo
                    </Button>
                </form>
            </Card>
        </div>
    );
}
