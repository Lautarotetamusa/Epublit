import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Breadcrumb, Button, Card, EmptyState } from "../../design-system";
import { FullscreenSpinner } from "../../components/FullscreenSpinner";
import { useConfirm } from "../../notifications/ConfirmProvider";
import { useToast } from "../../notifications/ToastProvider";
import { getErrorMessage } from "../../lib/errors";
import { TipoEdicionFormFields, isTipoEdicionFormValid } from "./TipoEdicionFormFields";
import type { TipoEdicionFormValues } from "./TipoEdicionFormFields";
import { useFichaTipoEdicion } from "./useFichaTipoEdicion";

export function FichaTipoEdicionPage() {
    const { id = "" } = useParams();
    const { tipo, loading, update, remove } = useFichaTipoEdicion(Number(id));
    const { showToast } = useToast();
    const confirm = useConfirm();
    const navigate = useNavigate();

    if (loading) return <FullscreenSpinner />;

    if (!tipo) {
        return (
            <Card>
                <EmptyState
                    icon="book-marked"
                    title="No encontramos este tipo de edición"
                    description="Puede que lo hayas dado de baja, o que el enlace esté mal."
                    action={<Button onClick={() => navigate("/tipos-edicion")}>Volver a tipos de edición</Button>}
                />
            </Card>
        );
    }

    const handleBaja = async () => {
        const ok = await confirm({
            title: `¿Dar de baja «${tipo.nombre}»?`,
            description: "Deja de ofrecerse al cargar un libro. Los libros que ya lo usan siguen mostrando su nombre.",
            confirmLabel: "Dar de baja",
            tone: "danger"
        });
        if (!ok) return;

        try {
            await remove();
            showToast("success", "Tipo de edición dado de baja");
            navigate("/tipos-edicion");
        } catch (err) {
            showToast("error", getErrorMessage(err));
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <Breadcrumb
                items={["Tipos de edición", tipo.nombre]}
                onNavigate={(_item, index) => index === 0 && navigate("/tipos-edicion")}
            />

            <EdicionTipoEdicionForm
                key={tipo.id}
                values={{ nombre: tipo.nombre }}
                onSave={async (input) => {
                    try {
                        await update(input);
                        showToast("success", "Tipo de edición actualizado");
                    } catch (err) {
                        showToast("error", getErrorMessage(err));
                    }
                }}
            />

            <Card title="Dar de baja">
                <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                    El tipo deja de aparecer al cargar un libro, pero los libros que ya lo usan siguen mostrando su nombre. Podés volver a crear un
                    tipo con el mismo nombre.
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

function EdicionTipoEdicionForm({
    values: initial,
    onSave
}: {
    values: TipoEdicionFormValues;
    onSave: (input: { nombre: string }) => Promise<void>;
}) {
    const [values, setValues] = useState<TipoEdicionFormValues>(initial);
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setSaving(true);
        await onSave({ nombre: values.nombre.trim() });
        setSaving(false);
    };

    return (
        <Card title={initial.nombre}>
            <form onSubmit={handleSubmit}>
                <TipoEdicionFormFields values={values} onChange={(patch) => setValues((current) => ({ ...current, ...patch }))} />
                <Button type="submit" style={{ marginTop: "var(--space-4)" }} loading={saving} disabled={!isTipoEdicionFormValid(values)}>
                    Guardar cambios
                </Button>
            </form>
        </Card>
    );
}
