import { Field, Input } from "../../design-system";

export type RolFormValues = {
    nombre: string;
};

type Props = {
    values: RolFormValues;
    onChange: (patch: Partial<RolFormValues>) => void;
};

// El nombre es el único dato de un rol (plan 011). Se comparte entre el alta y
// la ficha para que las dos pantallas pidan lo mismo.
export function RolFormFields({ values, onChange }: Props) {
    return (
        <Field
            label="Nombre"
            required
            hint="Así aparece el rol en la ficha de cada persona y en el libro. Cambiarlo lo cambia en todas."
        >
            <Input
                value={values.nombre}
                onChange={(e) => onChange({ nombre: e.target.value })}
                style={{ maxWidth: 420 }}
            />
        </Field>
    );
}

export const isRolFormValid = (values: RolFormValues): boolean => values.nombre.trim() !== "";
