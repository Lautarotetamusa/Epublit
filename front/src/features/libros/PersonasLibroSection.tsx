import { useState } from "react";
import type { FormEvent } from "react";
import { Card, Button, IconButton, Input, Field, Select, Dialog, Table, Badge } from "../../design-system";
import type { PersonaEnLibro } from "../../api/libro";
import type { Persona, CreatePersonaInput, TipoPersona } from "../../api/persona";
import { useToast } from "../../notifications/ToastProvider";
import { getErrorMessage } from "../../lib/errors";
import { sanitizeDecimal, sanitizeInteger, clampRange } from "../../lib/numericInput";
import { isValidEmail } from "../../lib/validation";

const TIPO_LABEL: Record<TipoPersona, string> = { autor: "Autor", ilustrador: "Ilustrador" };
const TIPO_OPTIONS = Object.entries(TIPO_LABEL).map(([value, label]) => ({ value, label }));

type Props = {
    personasEnLibro: PersonaEnLibro[];
    todasLasPersonas: Persona[];
    onAgregarExistente: (tipo: TipoPersona, idPersona: number, porcentaje: number) => Promise<void>;
    onAgregarNueva: (tipo: TipoPersona, input: CreatePersonaInput, porcentaje: number) => Promise<void>;
    onActualizarPorcentaje: (tipo: TipoPersona, idPersona: number, porcentaje: number) => Promise<void>;
    onQuitar: (tipo: TipoPersona, idPersona: number) => Promise<void>;
};

// Autores e ilustradores son la misma relación libro-persona con distinto
// `tipo` (ver back/src/modules/libroPersona), así que comparten una sola
// tabla en vez de una sección por tipo.
export function PersonasLibroSection({
    personasEnLibro,
    todasLasPersonas,
    onAgregarExistente,
    onAgregarNueva,
    onActualizarPorcentaje,
    onQuitar
}: Props) {
    const { showToast } = useToast();
    const [showExistente, setShowExistente] = useState(false);
    const [showNueva, setShowNueva] = useState(false);

    const handleQuitar = async (p: PersonaEnLibro) => {
        try {
            await onQuitar(p.tipo, p.id_persona);
        } catch (err) {
            showToast("error", getErrorMessage(err));
        }
    };

    const handlePorcentajeBlur = async (p: PersonaEnLibro, rawValue: string) => {
        const value = clampRange(rawValue, 0, 100);
        const porcentaje = Number(value);
        if (porcentaje === p.porcentaje || Number.isNaN(porcentaje)) return;
        try {
            await onActualizarPorcentaje(p.tipo, p.id_persona, porcentaje);
        } catch (err) {
            showToast("error", getErrorMessage(err));
        }
    };

    return (
        <Card
            title="Autores e ilustradores"
            padded={false}
            actions={
                <>
                    <Button variant="secondary" size="sm" onClick={() => setShowExistente(true)}>
                        Persona existente
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setShowNueva(true)}>
                        Nueva persona
                    </Button>
                </>
            }
        >
            <Table
                columns={[
                    { header: "Nombre", key: "nombre" },
                    {
                        header: "Rol",
                        cell: (p: PersonaEnLibro) => (
                            <Badge tone={p.tipo === "autor" ? "brand" : "accent"}>{TIPO_LABEL[p.tipo]}</Badge>
                        )
                    },
                    {
                        header: "Porcentaje",
                        align: "right",
                        cell: (p: PersonaEnLibro) => (
                            <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                <Input
                                    type="text"
                                    inputMode="decimal"
                                    defaultValue={p.porcentaje}
                                    style={{ width: 90 }}
                                    suffix="%"
                                    onChange={(e) => (e.target.value = sanitizeDecimal(e.target.value))}
                                    onBlur={(e) => {
                                        e.target.value = clampRange(e.target.value, 0, 100);
                                        handlePorcentajeBlur(p, e.target.value);
                                    }}
                                />
                            </div>
                        )
                    },
                    {
                        header: "",
                        align: "right",
                        width: 48,
                        cell: (p: PersonaEnLibro) => (
                            <IconButton icon="x" label={`Quitar a ${p.nombre}`} variant="ghost" onClick={() => handleQuitar(p)} />
                        )
                    }
                ]}
                rows={personasEnLibro}
                empty="Todavía no hay autores ni ilustradores en este libro."
            />

            {showExistente ? (
                <AgregarExistenteDialog
                    personasEnLibro={personasEnLibro}
                    todasLasPersonas={todasLasPersonas}
                    onClose={() => setShowExistente(false)}
                    onSave={async (tipo, idPersona, porcentaje) => {
                        try {
                            await onAgregarExistente(tipo, idPersona, porcentaje);
                            setShowExistente(false);
                        } catch (err) {
                            showToast("error", getErrorMessage(err));
                        }
                    }}
                />
            ) : null}

            {showNueva ? (
                <AgregarNuevaDialog
                    onClose={() => setShowNueva(false)}
                    onSave={async (tipo, input, porcentaje) => {
                        try {
                            await onAgregarNueva(tipo, input, porcentaje);
                            setShowNueva(false);
                        } catch (err) {
                            showToast("error", getErrorMessage(err));
                        }
                    }}
                />
            ) : null}
        </Card>
    );
}

function AgregarExistenteDialog({
    personasEnLibro,
    todasLasPersonas,
    onClose,
    onSave
}: {
    personasEnLibro: PersonaEnLibro[];
    todasLasPersonas: Persona[];
    onClose: () => void;
    onSave: (tipo: TipoPersona, idPersona: number, porcentaje: number) => Promise<void>;
}) {
    const [tipo, setTipo] = useState<TipoPersona>("autor");
    const disponibles = todasLasPersonas.filter(
        (p) => !personasEnLibro.some((pl) => pl.id_persona === p.id && pl.tipo === tipo)
    );
    const [idPersona, setIdPersona] = useState<number | "">(disponibles[0]?.id ?? "");
    const [porcentaje, setPorcentaje] = useState("0");
    const [saving, setSaving] = useState(false);

    const handleTipoChange = (nuevoTipo: TipoPersona) => {
        setTipo(nuevoTipo);
        const disponiblesParaTipo = todasLasPersonas.filter(
            (p) => !personasEnLibro.some((pl) => pl.id_persona === p.id && pl.tipo === nuevoTipo)
        );
        setIdPersona(disponiblesParaTipo[0]?.id ?? "");
    };

    const handleSave = async () => {
        if (idPersona === "") return;
        setSaving(true);
        await onSave(tipo, Number(idPersona), Number(clampRange(porcentaje, 0, 100)));
        setSaving(false);
    };

    return (
        <Dialog
            open
            title="Persona existente"
            onClose={onClose}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSave} loading={saving}>
                        Agregar
                    </Button>
                </>
            }
        >
            <Field label="Rol">
                <Select value={tipo} onChange={(e) => handleTipoChange(e.target.value as TipoPersona)} options={TIPO_OPTIONS} />
            </Field>
            <Field label="Persona" style={{ marginTop: "var(--space-4)" }}>
                <Select
                    value={String(idPersona)}
                    onChange={(e) => setIdPersona(Number(e.target.value))}
                    options={disponibles.map((p) => ({ value: String(p.id), label: p.nombre }))}
                />
            </Field>
            <Field label="Porcentaje" style={{ marginTop: "var(--space-4)" }}>
                <Input
                    type="text"
                    inputMode="decimal"
                    value={porcentaje}
                    onChange={(e) => setPorcentaje(sanitizeDecimal(e.target.value))}
                    onBlur={(e) => setPorcentaje(clampRange(e.target.value, 0, 100))}
                />
            </Field>
        </Dialog>
    );
}

function AgregarNuevaDialog({
    onClose,
    onSave
}: {
    onClose: () => void;
    onSave: (tipo: TipoPersona, input: CreatePersonaInput, porcentaje: number) => Promise<void>;
}) {
    const [tipo, setTipo] = useState<TipoPersona>("autor");
    const [inputs, setInputs] = useState({ nombre: "", email: "", dni: "", porcentaje: "0" });
    const [saving, setSaving] = useState(false);
    const [emailTouched, setEmailTouched] = useState(false);
    const emailInvalid = emailTouched && inputs.email !== "" && !isValidEmail(inputs.email);
    const formValid = inputs.nombre.trim() !== "" && inputs.dni.trim() !== "" && (inputs.email === "" || isValidEmail(inputs.email));

    const handleSave = async (event: FormEvent) => {
        event.preventDefault();
        setSaving(true);
        await onSave(tipo, { nombre: inputs.nombre, email: inputs.email, dni: inputs.dni }, Number(clampRange(inputs.porcentaje, 0, 100)));
        setSaving(false);
    };

    return (
        <Dialog
            open
            title="Nueva persona"
            onClose={onClose}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSave} loading={saving} disabled={!formValid}>
                        Agregar
                    </Button>
                </>
            }
        >
            <form onSubmit={handleSave}>
                <Field label="Rol">
                    <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoPersona)} options={TIPO_OPTIONS} />
                </Field>
                <Field label="Nombre" required style={{ marginTop: "var(--space-4)" }}>
                    <Input value={inputs.nombre} onChange={(e) => setInputs((v) => ({ ...v, nombre: e.target.value }))} />
                </Field>
                <Field label="Email" style={{ marginTop: "var(--space-4)" }} error={emailInvalid ? "Ingresá un email válido" : undefined}>
                    <Input
                        type="email"
                        invalid={emailInvalid}
                        value={inputs.email}
                        onChange={(e) => setInputs((v) => ({ ...v, email: e.target.value }))}
                        onBlur={() => setEmailTouched(true)}
                    />
                </Field>
                <Field label="DNI" required style={{ marginTop: "var(--space-4)" }}>
                    <Input value={inputs.dni} onChange={(e) => setInputs((v) => ({ ...v, dni: sanitizeInteger(e.target.value) }))} />
                </Field>
                <Field label="Porcentaje" style={{ marginTop: "var(--space-4)" }}>
                    <Input
                        type="text"
                        inputMode="decimal"
                        value={inputs.porcentaje}
                        onChange={(e) => setInputs((v) => ({ ...v, porcentaje: sanitizeDecimal(e.target.value) }))}
                        onBlur={(e) => setInputs((v) => ({ ...v, porcentaje: clampRange(e.target.value, 0, 100) }))}
                    />
                </Field>
            </form>
        </Dialog>
    );
}
