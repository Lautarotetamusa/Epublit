import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, Breadcrumb } from "../../design-system";
import type { UpdatePersonaInput } from "../../api/persona";
import { useFichaPersona } from "./useFichaPersona";
import { useFotoPersonaConfig } from "./useFotoPersonaConfig";
import { FullscreenSpinner } from "../../components/FullscreenSpinner";
import { useToast } from "../../notifications/ToastProvider";
import { useConfirm } from "../../notifications/ConfirmProvider";
import { getErrorMessage } from "../../lib/errors";
import { PersonaFormPanel } from "./PersonaFormPanel";
import type { PersonaFormValues } from "./PersonaFormFields";

export function FichaPersonaPage() {
    const { id = "" } = useParams();
    const { persona, loading, update, uploadFoto, uploadingFoto, removeFoto } = useFichaPersona(Number(id));
    const fotoConfig = useFotoPersonaConfig();
    const { showToast } = useToast();
    const confirm = useConfirm();
    const navigate = useNavigate();

    if (loading || !persona) return <FullscreenSpinner />;

    const handleSave = async (input: UpdatePersonaInput) => {
        try {
            await update(input);
            showToast("success", "Persona actualizada correctamente");
        } catch (err) {
            showToast("error", getErrorMessage(err));
        }
    };

    const handleSelectFoto = async (file: File) => {
        try {
            await uploadFoto(file);
        } catch (err) {
            showToast("error", getErrorMessage(err));
        }
    };

    const handleRemoveFoto = async () => {
        const ok = await confirm({
            title: "¿Quitar la foto?",
            description: `${persona.nombre} va a quedar sin foto hasta que subas otra.`,
            confirmLabel: "Quitar"
        });
        if (!ok) return;
        try {
            await removeFoto();
        } catch (err) {
            showToast("error", getErrorMessage(err));
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <Breadcrumb items={["Personas", persona.nombre]} onNavigate={(_item, index) => index === 0 && navigate("/personas")} />
            <Card title={persona.nombre}>
                <EdicionPersonaForm
                    persona={persona}
                    fotoConfig={fotoConfig}
                    uploadingFoto={uploadingFoto}
                    onSave={handleSave}
                    onSelectFoto={handleSelectFoto}
                    onRemoveFoto={handleRemoveFoto}
                    onRejectedFoto={(message) => showToast("error", message)}
                />
            </Card>
        </div>
    );
}

function EdicionPersonaForm({
    persona,
    fotoConfig,
    uploadingFoto,
    onSave,
    onSelectFoto,
    onRemoveFoto,
    onRejectedFoto
}: {
    persona: { nombre: string; email: string | null; dni: string; bio: string | null; fotoUrl: string | null };
    fotoConfig: { maxSizeMb: number | null; minAnchoPx: number | null; minAltoPx: number | null } | null;
    uploadingFoto: boolean;
    onSave: (input: UpdatePersonaInput) => Promise<void>;
    onSelectFoto: (file: File) => void;
    onRemoveFoto: () => void;
    onRejectedFoto: (message: string) => void;
}) {
    const [inputs, setInputs] = useState<PersonaFormValues>({
        nombre: persona.nombre,
        email: persona.email ?? "",
        dni: persona.dni,
        bio: persona.bio ?? ""
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setSaving(true);
        await onSave({ nombre: inputs.nombre, email: inputs.email, dni: inputs.dni, bio: inputs.bio });
        setSaving(false);
    };

    return (
        <PersonaFormPanel
            foto={{
                value: persona.fotoUrl ?? undefined,
                onSelect: onSelectFoto,
                onRemove: onRemoveFoto,
                onRejected: onRejectedFoto,
                disabled: uploadingFoto,
                maxSizeMb: fotoConfig?.maxSizeMb ?? undefined,
                minWidthPx: fotoConfig?.minAnchoPx ?? undefined,
                minHeightPx: fotoConfig?.minAltoPx ?? undefined
            }}
            values={inputs}
            onChange={(patch) => setInputs((v) => ({ ...v, ...patch }))}
            onSubmit={handleSubmit}
            saving={saving}
            submitLabel="Guardar cambios"
        />
    );
}
