import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Alert, Breadcrumb, Button, Card, EmptyState } from "../../design-system";
import { FullscreenSpinner } from "../../components/FullscreenSpinner";
import { useConfirm } from "../../notifications/ConfirmProvider";
import { useToast } from "../../notifications/ToastProvider";
import { getErrorMessage } from "../../lib/errors";
import { RolFormFields, isRolFormValid } from "./RolFormFields";
import type { RolFormValues } from "./RolFormFields";
import { useFichaRol } from "./useFichaRol";
import { useUsosDeRol } from "./useUsosDeRol";
import { nombreVisible } from "./presentacionRol";

export function FichaRolPage() {
    const { id = "" } = useParams();
    const { rol, loading, update, remove } = useFichaRol(Number(id));
    const usos = useUsosDeRol(rol);
    const { showToast } = useToast();
    const confirm = useConfirm();
    const navigate = useNavigate();

    if (loading) return <FullscreenSpinner />;

    if (!rol) {
        return (
            <Card>
                <EmptyState
                    icon="tag"
                    title="El rol no existe"
                    description="Puede que lo hayas dado de baja, o que el enlace esté mal."
                    action={<Button onClick={() => navigate("/roles")}>Volver a roles</Button>}
                />
            </Card>
        );
    }

    // Mientras no se sabe cuántas personas lo usan, la baja no se ofrece: es la
    // única forma de que el motivo del bloqueo (plan 011: un rol en uso no se da
    // de baja) esté a la vista antes de intentarlo.
    const enUso = (usos ?? 0) > 0;

    const handleBaja = async () => {
        const ok = await confirm({
            title: `¿Dar de baja «${nombreVisible(rol.nombre)}»?`,
            description: "Deja de ofrecerse al asignar personas a un libro. Podés volver a crear un rol con el mismo nombre.",
            confirmLabel: "Dar de baja",
            tone: "danger"
        });
        if (!ok) return;

        try {
            await remove();
            showToast("success", "Rol dado de baja correctamente");
            navigate("/roles");
        } catch (err) {
            showToast("error", getErrorMessage(err));
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <Breadcrumb
                items={["Roles", nombreVisible(rol.nombre)]}
                onNavigate={(_item, index) => index === 0 && navigate("/roles")}
            />

            <EdicionRolForm
                key={rol.id}
                values={{ nombre: rol.nombre }}
                onSave={async (input) => {
                    try {
                        await update(input);
                        showToast("success", "Rol actualizado correctamente");
                    } catch (err) {
                        showToast("error", getErrorMessage(err));
                    }
                }}
            />

            <Card title="Dar de baja">
                {enUso ? (
                    <Alert tone="warning" title="Está en uso">
                        {usos === 1 ? "Una persona lo usa" : `${usos} personas lo usan`} en sus libros. Cambiales el rol desde la ficha de
                        cada libro antes de darlo de baja.
                    </Alert>
                ) : (
                    <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                        Nadie lo está usando en un libro: podés darlo de baja y dejar de ofrecerlo al asignar personas. El nombre queda
                        libre para volver a crear un rol con el mismo.
                    </p>
                )}
                <div style={{ marginTop: "var(--space-4)" }}>
                    <Button variant="danger" disabled={usos === null || enUso} onClick={handleBaja}>
                        Dar de baja
                    </Button>
                </div>
            </Card>
        </div>
    );
}

function EdicionRolForm({
    values: initial,
    onSave
}: {
    values: RolFormValues;
    onSave: (input: { nombre: string }) => Promise<void>;
}) {
    const [values, setValues] = useState<RolFormValues>(initial);
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setSaving(true);
        await onSave({ nombre: values.nombre.trim() });
        setSaving(false);
    };

    return (
        <Card title={nombreVisible(initial.nombre)} subtitle="El nombre del rol, tal como se ve en las personas y en los libros.">
            <form onSubmit={handleSubmit}>
                <RolFormFields values={values} onChange={(patch) => setValues((current) => ({ ...current, ...patch }))} />
                <Button type="submit" style={{ marginTop: "var(--space-4)" }} loading={saving} disabled={!isRolFormValid(values)}>
                    Guardar cambios
                </Button>
            </form>
        </Card>
    );
}
