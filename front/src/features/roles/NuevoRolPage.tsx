import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Breadcrumb, Button, Card } from "../../design-system";
import { useToast } from "../../notifications/ToastProvider";
import { getErrorMessage } from "../../lib/errors";
import { RolFormFields, isRolFormValid } from "./RolFormFields";
import type { RolFormValues } from "./RolFormFields";
import { useNuevoRol } from "./useNuevoRol";

export function NuevoRolPage() {
    const { saving, create } = useNuevoRol();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const [values, setValues] = useState<RolFormValues>({ nombre: "" });

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        try {
            const rol = await create({ nombre: values.nombre.trim() });
            showToast("success", "Rol creado correctamente");
            navigate(`/roles/${rol.id}`);
        } catch (err) {
            showToast("error", getErrorMessage(err));
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <Breadcrumb items={["Roles", "Nuevo rol"]} onNavigate={(_item, index) => index === 0 && navigate("/roles")} />
            <Card title="Nuevo rol" subtitle="Después vas a poder elegirlo al asignar una persona a un libro.">
                <form onSubmit={handleSubmit}>
                    <RolFormFields values={values} onChange={(patch) => setValues((current) => ({ ...current, ...patch }))} />
                    <Button type="submit" style={{ marginTop: "var(--space-4)" }} loading={saving} disabled={!isRolFormValid(values)}>
                        Guardar rol
                    </Button>
                </form>
            </Card>
        </div>
    );
}
