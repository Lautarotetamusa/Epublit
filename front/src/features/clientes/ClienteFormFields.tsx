import { useState } from "react";
import { Field, Input } from "../../design-system";
import { sanitizeInteger } from "../../lib/numericInput";
import { isValidCuit, isValidEmail } from "../../lib/validation";

export type ClienteFormValues = {
    nombre: string;
    email: string;
    cuit: string;
};

type Props = {
    values: ClienteFormValues;
    onChange: (patch: Partial<ClienteFormValues>) => void;
    // Sólo el alta pide Nombre/CUIT obligatorios; en la edición ya están
    // cargados y no tiene sentido marcarlos con asterisco.
    required?: boolean;
};

export function isClienteFormValid(values: ClienteFormValues): boolean {
    if (values.nombre.trim() === "") return false;
    if (!isValidCuit(values.cuit)) return false;
    if (values.email !== "" && !isValidEmail(values.email)) return false;
    return true;
}

// Campos compartidos por la ficha de cliente (edición) y el alta de cliente
// nuevo: mismos inputs, misma sanitización/validación del CUIT y del email.
export function ClienteFormFields({ values, onChange, required }: Props) {
    const [touched, setTouched] = useState({ email: false, cuit: false });
    const emailInvalid = touched.email && values.email !== "" && !isValidEmail(values.email);
    const cuitInvalid = touched.cuit && !isValidCuit(values.cuit);

    return (
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "var(--space-4)", alignItems: "end" }}>
            <Field label="Nombre" required={required}>
                <Input value={values.nombre} onChange={(e) => onChange({ nombre: e.target.value })} />
            </Field>
            <Field label="Email" error={emailInvalid ? "Ingresá un email válido" : undefined}>
                <Input
                    type="email"
                    invalid={emailInvalid}
                    value={values.email}
                    onChange={(e) => onChange({ email: e.target.value })}
                    onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                />
            </Field>
            <Field label="CUIT" required={required} error={cuitInvalid ? "El CUIT debe tener 11 dígitos" : undefined}>
                <Input
                    invalid={cuitInvalid}
                    maxLength={11}
                    inputMode="numeric"
                    value={values.cuit}
                    onChange={(e) => onChange({ cuit: sanitizeInteger(e.target.value) })}
                    onBlur={() => setTouched((t) => ({ ...t, cuit: true }))}
                />
            </Field>
        </div>
    );
}
