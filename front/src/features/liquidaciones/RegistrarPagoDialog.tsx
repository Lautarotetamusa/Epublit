import { useState } from "react";
import { Button, Dialog, Field, Input, Select, Textarea } from "../../design-system";
import type { RegistrarPagoInput } from "../../api/liquidaciones";
import { formatMoney } from "../../lib/money";
import { hoyISO } from "./presentacionLiquidacion";

// A quién se le puede pagar: una persona de la liquidación, o el único titular
// de un anticipo. `saldo` es el techo del monto y el valor por defecto.
export type CandidatoPago = {
    id: number;
    nombre: string;
    detalle?: string;
    saldo: number;
};

type Props = {
    title: string;
    description?: string;
    candidatos: CandidatoPago[];
    candidatoInicial?: number;
    /** Devuelve `true` si el pago se registró: sólo entonces el diálogo se cierra. */
    onConfirm: (id: number, input: RegistrarPagoInput) => Promise<boolean>;
    onClose: () => void;
};

// Pago parcial de una persona dentro de una liquidación: es el único caso con
// monto a decidir (los anticipos se marcan como pagados, no se pagan en partes).
// Arranca con el saldo completo cargado porque el caso más común es pagar todo,
// y bajar el monto es la excepción.
export function RegistrarPagoDialog({ title, description, candidatos, candidatoInicial, onConfirm, onClose }: Props) {
    const inicial = candidatoInicial ?? candidatos.find((c) => c.saldo > 0)?.id ?? candidatos[0].id;
    const [idSeleccionado, setIdSeleccionado] = useState(inicial);
    const [monto, setMonto] = useState(String(candidatos.find((c) => c.id === inicial)?.saldo ?? ""));
    const [fecha, setFecha] = useState(hoyISO());
    const [nota, setNota] = useState("");
    const [saving, setSaving] = useState(false);

    const seleccionado = candidatos.find((c) => c.id === idSeleccionado) ?? candidatos[0];
    const montoNumero = Number(monto.replace(",", "."));
    const montoValido = monto !== "" && Number.isFinite(montoNumero) && montoNumero > 0;
    const excedeSaldo = montoValido && montoNumero > seleccionado.saldo;

    const cambiarCandidato = (value: string) => {
        const id = Number(value);
        setIdSeleccionado(id);
        setMonto(String(candidatos.find((c) => c.id === id)?.saldo ?? ""));
    };

    const handleSubmit = async () => {
        if (!montoValido || excedeSaldo || !fecha) return;

        setSaving(true);
        const registrado = await onConfirm(seleccionado.id, { monto: montoNumero, fecha, nota: nota.trim() || undefined });
        setSaving(false);
        if (registrado) onClose();
    };

    return (
        <Dialog
            open
            title={title}
            description={description}
            width={460}
            onClose={onClose}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button loading={saving} disabled={!montoValido || excedeSaldo} onClick={handleSubmit}>
                        Registrar pago
                    </Button>
                </>
            }
        >
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                {candidatos.length > 1 ? (
                    <Field label="A quién le pagás" required>
                        <Select
                            value={String(idSeleccionado)}
                            onChange={(e) => cambiarCandidato(e.target.value)}
                            options={candidatos.map((c) => ({ value: String(c.id), label: `${c.nombre} — ${formatMoney(c.saldo)}` }))}
                        />
                    </Field>
                ) : (
                    <div>
                        <span className="eyebrow">Persona</span>
                        <p style={{ margin: "4px 0 0", fontWeight: "var(--weight-semibold)" }}>{seleccionado.nombre}</p>
                        {seleccionado.detalle ? (
                            <p style={{ margin: "2px 0 0", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{seleccionado.detalle}</p>
                        ) : null}
                    </div>
                )}

                <Field
                    label="Monto"
                    required
                    error={excedeSaldo ? `No podés pagar más que el saldo (${formatMoney(seleccionado.saldo)}).` : undefined}
                    hint={`Saldo pendiente: ${formatMoney(seleccionado.saldo)}`}
                >
                    <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={monto}
                        onChange={(e) => setMonto(e.target.value)}
                        iconStart="banknote"
                        suffix="ARS"
                    />
                </Field>
                <div style={{ marginTop: "calc(-1 * var(--space-2))" }}>
                    <Button variant="ghost" size="sm" disabled={seleccionado.saldo <= 0} onClick={() => setMonto(String(seleccionado.saldo))}>
                        Pagar el saldo completo
                    </Button>
                </div>

                <Field label="Fecha del pago" required>
                    <Input type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} />
                </Field>

                <Field label="Nota" hint="Queda en el historial de pagos: medio, comprobante, lo que haga falta recordar.">
                    <Textarea rows={2} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Transferencia, comprobante 0001-0002…" />
                </Field>
            </div>
        </Dialog>
    );
}
