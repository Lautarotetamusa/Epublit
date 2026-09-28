import type { FormEvent } from "react";
import { Button, Field, PhotoUpload } from "../../design-system";
import { PersonaFormFields, isPersonaFormValid } from "./PersonaFormFields";
import type { PersonaFormValues } from "./PersonaFormFields";

type PersonaFotoProps = {
    value?: string;
    onSelect: (file: File) => void;
    onRemove?: () => void;
    onRejected?: (message: string) => void;
    maxSizeMb?: number;
    minWidthPx?: number;
    minHeightPx?: number;
    disabled?: boolean;
    hint?: string;
};

// Layout compartido por el alta y la ficha de persona (ver design.md
// 005-unificar-personas): todo apilado en una sola columna, con la foto
// primero y el resto de los campos + el botón de guardar debajo. Lo único
// que cambia entre las dos páginas es qué hacen con la foto elegida y con
// el submit — ver NuevaPersonaPage.tsx (guarda todo junto al crear) y
// FichaPersonaPage.tsx (sube la foto de inmediato, ya con la persona
// creada).
export function PersonaFormPanel({
    foto,
    values,
    onChange,
    onSubmit,
    saving,
    submitLabel
}: {
    foto: PersonaFotoProps;
    values: PersonaFormValues;
    onChange: (patch: Partial<PersonaFormValues>) => void;
    onSubmit: (event: FormEvent) => void;
    saving: boolean;
    submitLabel: string;
}) {
    const formValid = isPersonaFormValid(values);

    return (
        <form onSubmit={onSubmit}>
            <Field label="Foto" hint={foto.hint}>
                <PhotoUpload
                    value={foto.value}
                    onSelect={foto.onSelect}
                    onRemove={foto.onRemove}
                    onRejected={foto.onRejected}
                    maxSizeMb={foto.maxSizeMb}
                    minWidthPx={foto.minWidthPx}
                    minHeightPx={foto.minHeightPx}
                    disabled={foto.disabled}
                />
            </Field>
            <div style={{ marginTop: "var(--space-4)" }}>
                <PersonaFormFields values={values} onChange={onChange} />
            </div>
            <Button type="submit" style={{ marginTop: "var(--space-4)" }} loading={saving} disabled={!formValid}>
                {submitLabel}
            </Button>
        </form>
    );
}
