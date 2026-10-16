import { Field, Input } from "../../design-system";
import { clampRange, sanitizeDecimal } from "../../lib/numericInput";

export type MedioPagoFormValues = {
    nombre: string;
    comision: string;
};

type Props = {
    values: MedioPagoFormValues;
    onChange: (patch: Partial<MedioPagoFormValues>) => void;
};

// Nombre + comisión: los mismos dos campos en el alta y en la edición del
// medio de pago.
export function MedioPagoFormFields({ values, onChange }: Props) {
    return (
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "var(--space-4)" }}>
            <Field label="Nombre" required>
                <Input value={values.nombre} onChange={(e) => onChange({ nombre: e.target.value })} />
            </Field>
            <Field label="Comisión (%)" hint="Opcional. Se descuenta del total al registrar una venta.">
                <Input
                    inputMode="decimal"
                    value={values.comision}
                    onChange={(e) => onChange({ comision: sanitizeDecimal(e.target.value) })}
                    onBlur={() => onChange({ comision: clampRange(values.comision, 0, 100) })}
                />
            </Field>
        </div>
    );
}

// Comisión vacía vale 0 (default del backend); cualquier valor fuera de
// [0, 100] bloquea el guardado.
export function isMedioPagoFormValid(values: MedioPagoFormValues): boolean {
    if (values.nombre.trim() === "") return false;
    if (values.comision === "") return true;
    const comision = Number(values.comision);
    return comision >= 0 && comision <= 100;
}

// Normaliza el string del input al número que espera la API.
export function comisionDeValor(value: string): number {
    return value === "" ? 0 : Number(value);
}
