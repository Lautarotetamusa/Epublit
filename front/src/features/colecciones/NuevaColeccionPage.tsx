import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Breadcrumb, Button, Card, CoverUpload, Field } from "../../design-system";
import { useToast } from "../../notifications/ToastProvider";
import { getErrorMessage } from "../../lib/errors";
import { useFilePreview } from "../../lib/useFilePreview";
import { useNuevaColeccion } from "./useNuevaColeccion";
import { ColeccionFormFields, isColeccionFormValid } from "./ColeccionFormFields";
import type { ColeccionFormValues } from "./ColeccionFormFields";

export function NuevaColeccionPage() {
    const { saving, create } = useNuevaColeccion();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const [inputs, setInputs] = useState<ColeccionFormValues>({ titulo: "", descripcion: "" });
    const [portadaFile, setPortadaFile] = useState<File | null>(null);
    const portadaPreview = useFilePreview(portadaFile);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        try {
            const coleccion = await create(
                { titulo: inputs.titulo, descripcion: inputs.descripcion || undefined },
                portadaFile
            );
            showToast("success", "Colección creada correctamente");
            navigate(`/colecciones/${coleccion.id}`);
        } catch (err) {
            showToast("error", getErrorMessage(err));
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <Breadcrumb
                items={["Colecciones", "Nueva colección"]}
                onNavigate={(_item, index) => index === 0 && navigate("/colecciones")}
            />
            <Card title="Nueva colección" subtitle="Después de crearla vas a poder agregarle libros.">
                <form onSubmit={handleSubmit}>
                    <Field label="Portada" hint="Opcional. Se puede agregar o cambiar después.">
                        <CoverUpload
                            value={portadaPreview || undefined}
                            onSelect={setPortadaFile}
                            onRemove={() => setPortadaFile(null)}
                        />
                    </Field>
                    <div style={{ marginTop: "var(--space-4)" }}>
                        <ColeccionFormFields values={inputs} onChange={(patch) => setInputs((current) => ({ ...current, ...patch }))} />
                    </div>
                    <Button type="submit" style={{ marginTop: "var(--space-4)" }} loading={saving} disabled={!isColeccionFormValid(inputs)}>
                        Guardar colección
                    </Button>
                </form>
            </Card>
        </div>
    );
}
