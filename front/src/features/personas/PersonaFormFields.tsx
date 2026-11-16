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
    if (values.email.trim() !== "" && !isValidEmail(values.email)) return false;
    return true;
}

// Campos compartidos por la ficha de persona (edición) y el alta: mismos
// inputs, misma validación de email, mismo campo de biografía.
export function PersonaFormFields({ values, onChange }: { values: PersonaFormValues; onChange: (patch: Partial<PersonaFormValues>) => void }) {
    const emailInvalid = values.email.trim() !== "" && !isValidEmail(values.email);
    // Un email que ya viene inválido al montar (dato viejo de la API o de una
    // importación) se marca desde el primer render: el botón de guardar nace
    // deshabilitado y, si el error esperara al blur, la ficha quedaría trabada
    // sin ningún motivo visible. Mientras la persona escribe, en cambio, se
    // espera a que salga del campo para no marcarlo en rojo en la primera "j".
    const [invalidOnMount] = useState(emailInvalid);
    const [emailTouched, setEmailTouched] = useState(false);
    const showEmailError = emailInvalid && (emailTouched || invalidOnMount);

    return (
        <>
            <Field label="Nombre" required>
                <Input value={values.nombre} onChange={(e) => onChange({ nombre: e.target.value })} />
            </Field>
            <Field label="Email" style={{ marginTop: "var(--space-4)" }} error={showEmailError ? "Ingresá un email válido." : undefined}>
                <Input
                    type="email"
                    invalid={showEmailError}
                    value={values.email}
                    // El email se guarda ya recortado: un espacio al final no
                    // aporta nada y es justo lo que después bloquea el submit.
                    onChange={(e) => onChange({ email: e.target.value.trim() })}
                    onBlur={() => setEmailTouched(true)}
                />
            </Field>
            <Field label="DNI" required style={{ marginTop: "var(--space-4)" }}>
                <Input value={values.dni} onChange={(e) => onChange({ dni: sanitizeInteger(e.target.value) })} />
            </Field>
            <Field label="Biografía" style={{ marginTop: "var(--space-4)" }}>
                <Textarea rows={5} value={values.bio} onChange={(e) => onChange({ bio: e.target.value })} />
            </Field>
        </>
    );
}
