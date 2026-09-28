import { useState } from "react";
import { Field, Input, Textarea } from "../../design-system";
import { sanitizeInteger } from "../../lib/numericInput";
import { isValidEmail } from "../../lib/validation";

export type PersonaFormValues = {
    nombre: string;
    email: string;
    dni: string;
    bio: string;
};

export function isPersonaFormValid(values: PersonaFormValues): boolean {
    if (values.nombre.trim() === "") return false;
    if (values.dni.trim() === "") return false;
    if (values.email !== "" && !isValidEmail(values.email)) return false;
    return true;
}

// Campos compartidos por la ficha de persona (edición) y el alta: mismos
// inputs, misma validación de email, mismo campo de biografía.
export function PersonaFormFields({ values, onChange }: { values: PersonaFormValues; onChange: (patch: Partial<PersonaFormValues>) => void }) {
    const [emailTouched, setEmailTouched] = useState(false);
    const emailInvalid = emailTouched && values.email !== "" && !isValidEmail(values.email);

    return (
        <>
            <Field label="Nombre" required>
                <Input value={values.nombre} onChange={(e) => onChange({ nombre: e.target.value })} />
            </Field>
            <Field label="Email" style={{ marginTop: "var(--space-4)" }} error={emailInvalid ? "Ingresá un email válido" : undefined}>
                <Input
                    type="email"
                    invalid={emailInvalid}
                    value={values.email}
                    onChange={(e) => onChange({ email: e.target.value })}
                    onBlur={() => setEmailTouched(true)}
                />
            </Field>
            <Field label="DNI" required style={{ marginTop: "var(--space-4)" }}>
                <Input value={values.dni} onChange={(e) => onChange({ dni: sanitizeInteger(e.target.value) })} />
            </Field>
            <Field label="Biografía" style={{ marginTop: "var(--space-4)" }} hint="Aparece en la ficha del autor o ilustrador.">
                <Textarea rows={5} value={values.bio} onChange={(e) => onChange({ bio: e.target.value })} />
            </Field>
        </>
    );
}
