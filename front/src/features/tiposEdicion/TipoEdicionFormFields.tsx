import { Field, Input } from "../../design-system";

export type TipoEdicionFormValues = {
    nombre: string;
};

type Props = {
    values: TipoEdicionFormValues;
    onChange: (patch: Partial<TipoEdicionFormValues>) => void;
};

// El nombre es el único dato de un tipo de edición. Se comparte entre el alta
// y la ficha para que las dos pantallas pidan lo mismo.
export function TipoEdicionFormFields({ values, onChange }: Props) {
    return (
        <Field
            label="Nombre"
            required
            hint="Así aparece el tipo en la ficha de cada libro. Cambiarlo lo cambia en todos los libros que lo usan."
        >
            <Input
                value={values.nombre}
                onChange={(e) => onChange({ nombre: e.target.value })}
                style={{ maxWidth: 420 }}
            />
        </Field>
    );
}

export const isTipoEdicionFormValid = (values: TipoEdicionFormValues): boolean => values.nombre.trim() !== "";
