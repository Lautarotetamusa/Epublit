import { Field, Input, Textarea } from "../../design-system";

export type ColeccionFormValues = {
    titulo: string;
    descripcion: string;
};

export function isColeccionFormValid(values: ColeccionFormValues): boolean {
    return values.titulo.trim() !== "";
}

// Campos compartidos por el alta y la ficha de colección: mismo par
// título/descripción, misma validación. La portada se resuelve aparte en
// cada pantalla, porque en el alta todavía no existe la colección a la que
// pertenece (ver NuevaColeccionPage y FichaColeccionPage).
export function ColeccionFormFields({ values, onChange }: { values: ColeccionFormValues; onChange: (patch: Partial<ColeccionFormValues>) => void }) {
    return (
        <>
            <Field label="Título" required>
                <Input value={values.titulo} onChange={(event) => onChange({ titulo: event.target.value })} />
            </Field>
            <Field
                label="Descripción"
                style={{ marginTop: "var(--space-4)" }}
                hint="Se muestra en el catálogo y en el sitio de la editorial."
            >
                <Textarea rows={4} value={values.descripcion} onChange={(event) => onChange({ descripcion: event.target.value })} />
            </Field>
        </>
    );
}
