import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Breadcrumb } from "../../design-system";
import { useNuevaPersona } from "./useNuevaPersona";
import { useFotoPersonaConfig } from "./useFotoPersonaConfig";
import { useToast } from "../../notifications/ToastProvider";
import { getErrorMessage } from "../../lib/errors";
import { useFilePreview } from "../../lib/useFilePreview";
import { PersonaFormPanel } from "./PersonaFormPanel";
import type { PersonaFormValues } from "./PersonaFormFields";

export function NuevaPersonaPage() {
    const { saving, create } = useNuevaPersona();
    const fotoConfig = useFotoPersonaConfig();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const [inputs, setInputs] = useState<PersonaFormValues>({ nombre: "", email: "", dni: "", bio: "" });
    const [fotoFile, setFotoFile] = useState<File | null>(null);
    const fotoPreview = useFilePreview(fotoFile);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        try {
            const persona = await create({ nombre: inputs.nombre, email: inputs.email, dni: inputs.dni, bio: inputs.bio || undefined }, fotoFile);
            showToast("success", "Persona creada correctamente");
            navigate(`/personas/${persona.id}`);
        } catch (err) {
            showToast("error", getErrorMessage(err));
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <Breadcrumb items={["Personas", "Nueva persona"]} onNavigate={(_item, index) => index === 0 && navigate("/personas")} />
            <Card title="Nueva persona">
                <PersonaFormPanel
                    foto={{
                        value: fotoPreview || undefined,
                        onSelect: setFotoFile,
                        onRemove: () => setFotoFile(null),
                        onRejected: (message) => showToast("error", message),
                        maxSizeMb: fotoConfig?.maxSizeMb ?? undefined,
                        minWidthPx: fotoConfig?.minAnchoPx ?? undefined,
                        minHeightPx: fotoConfig?.minAltoPx ?? undefined,
                        hint: "Se puede agregar ahora o después, desde la ficha."
                    }}
                    values={inputs}
                    onChange={(patch) => setInputs((v) => ({ ...v, ...patch }))}
                    onSubmit={handleSubmit}
                    saving={saving}
                    submitLabel="Guardar persona"
                />
            </Card>
        </div>
    );
}
