import { Field, Input, Textarea } from "../../design-system";

export type DepositoFormValues = {
    nombre: string;
    descripcion: string;
};

type Props = {
    values: DepositoFormValues;
    onChange: (patch: Partial<DepositoFormValues>) => void;
};

// Nombre + descripción: los mismos dos campos en el alta y en la edición del
// depósito.
export function DepositoFormFields({ values, onChange }: Props) {
    return (
        <>
            <Field label="Nombre" required>
                <Input value={values.nombre} onChange={(e) => onChange({ nombre: e.target.value })} />
            </Field>
            <Field label="Descripción" hint="Opcional. Ayuda a reconocerlo en el listado." style={{ marginTop: "var(--space-4)" }}>
                <Textarea rows={3} value={values.descripcion} onChange={(e) => onChange({ descripcion: e.target.value })} />
            </Field>
        </>
    );
}

export function isDepositoFormValid(values: DepositoFormValues): boolean {
    return values.nombre.trim() !== "";
}
