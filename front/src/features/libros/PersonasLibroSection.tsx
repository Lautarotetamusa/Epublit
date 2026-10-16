import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Card, Button, IconButton, Input, Field, Select, Dialog, Table, Badge } from "../../design-system";
import type { PersonaEnLibro } from "../../api/libro";
import type { Rol } from "../../api/rol";
import type { Persona, CreatePersonaInput } from "../../api/persona";
import { useToast } from "../../notifications/ToastProvider";
import { getErrorMessage } from "../../lib/errors";
import { formatMoney } from "../../lib/money";
import { sanitizeDecimal, sanitizeInteger, clampRange } from "../../lib/numericInput";
import { isValidEmail } from "../../lib/validation";
import { nombreVisible, opcionesDeRol, tonoDeRol } from "../roles/presentacionRol";

type Props = {
    personasEnLibro: PersonaEnLibro[];
    todasLasPersonas: Persona[];
    // Los roles activos de la cuenta (plan 011): el rol con el que una persona
    // trabaja en un libro ya no es un enum fijo, sale de acá.
    roles: Rol[];
    onAgregarExistente: (rol: Rol, idPersona: number, porcentaje: number, montoAcordado?: number) => Promise<void>;
    onAgregarNueva: (rol: Rol, input: CreatePersonaInput, porcentaje: number, montoAcordado?: number) => Promise<void>;
    // Actualiza la relación: el porcentaje siempre se manda, el anticipo sólo
    // cuando se pasa (omitido = se conserva el actual).
    onActualizarRelacion: (rol: Rol, idPersona: number, porcentaje: number, montoAcordado?: number) => Promise<void>;
    onQuitar: (rol: Rol, idPersona: number) => Promise<void>;
};

// Todas las personas del libro son la misma relación libro-persona con distinto
// rol (ver back/src/modules/libroPersona), así que comparten una sola tabla en
// vez de una sección por rol.
export function PersonasLibroSection({
    personasEnLibro,
    todasLasPersonas,
    roles,
    onAgregarExistente,
    onAgregarNueva,
    onActualizarRelacion,
    onQuitar
}: Props) {
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [showExistente, setShowExistente] = useState(false);
    const [showNueva, setShowNueva] = useState(false);

    const sinRoles = roles.length === 0;

    const handleQuitar = async (p: PersonaEnLibro) => {
        try {
            await onQuitar(p.rol, p.id_persona);
        } catch (err) {
            showToast("error", getErrorMessage(err));
        }
    };

    const handlePorcentajeBlur = async (p: PersonaEnLibro, rawValue: string) => {
        const value = clampRange(rawValue, 0, 100);
        const porcentaje = Number(value);
        if (porcentaje === p.porcentaje || Number.isNaN(porcentaje)) return;
        try {
            await onActualizarRelacion(p.rol, p.id_persona, porcentaje);
        } catch (err) {
            showToast("error", getErrorMessage(err));
        }
    };

    // El porcentaje actual viaja siempre: el backend lo exige, así que editar
    // sólo el anticipo no puede omitirlo.
    const handleAnticipoBlur = async (p: PersonaEnLibro, monto: number) => {
        try {
            await onActualizarRelacion(p.rol, p.id_persona, p.porcentaje, monto);
        } catch (err) {
            showToast("error", getErrorMessage(err));
        }
    };

    return (
        <Card
            title="Personas en el libro"
            subtitle="Una persona puede tener más de un rol en el mismo libro."
            padded={false}
            actions={
                <>
                    <Button variant="secondary" size="sm" disabled={sinRoles} onClick={() => setShowExistente(true)}>
                        Persona existente
                    </Button>
                    <Button variant="secondary" size="sm" disabled={sinRoles} onClick={() => setShowNueva(true)}>
                        Nueva persona
                    </Button>
                </>
            }
        >
            {sinRoles ? (
                <div style={{ padding: "var(--space-4)", borderBottom: "1px solid var(--border-subtle)" }}>
                    <Alert tone="warning" title="Todavía no hay roles cargados">
                        Sin roles no se puede asignar a nadie a un libro. Cargá al menos uno para seguir.
                    </Alert>
                    <Button variant="secondary" size="sm" style={{ marginTop: "var(--space-3)" }} onClick={() => navigate("/roles/nuevo")}>
                        Nuevo rol
                    </Button>
                </div>
            ) : null}

            <Table
                columns={[
                    { header: "Nombre", key: "nombre" },
                    {
                        header: "Rol",
                        cell: (p: PersonaEnLibro) => (
                            <Badge tone={tonoDeRol(p.rol)}>{nombreVisible(p.rol.nombre)}</Badge>
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
                        header: "Anticipo",
                        align: "right",
                        cell: (p: PersonaEnLibro) => (
                            <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                <AnticipoInput monto={p.monto_acordado} onCommit={(monto) => handleAnticipoBlur(p, monto)} />
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
                empty="Todavía no hay personas en este libro."
            />

            {showExistente ? (
                <AgregarExistenteDialog
                    personasEnLibro={personasEnLibro}
                    todasLasPersonas={todasLasPersonas}
                    roles={roles}
                    onClose={() => setShowExistente(false)}
                    onSave={async (rol, idPersona, porcentaje, montoAcordado) => {
                        try {
                            await onAgregarExistente(rol, idPersona, porcentaje, montoAcordado);
                            setShowExistente(false);
                        } catch (err) {
                            showToast("error", getErrorMessage(err));
                        }
                    }}
                />
            ) : null}

            {showNueva ? (
                <AgregarNuevaDialog
                    roles={roles}
                    onClose={() => setShowNueva(false)}
                    onSave={async (rol, input, porcentaje, montoAcordado) => {
                        try {
                            await onAgregarNueva(rol, input, porcentaje, montoAcordado);
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

// Ya trabajó en algún libro con ese rol: no se puede repetir la misma persona
// con el mismo rol en el mismo libro (plan 011, tarea 8).
const disponiblesPara = (todasLasPersonas: Persona[], personasEnLibro: PersonaEnLibro[], idRol: number): Persona[] =>
    todasLasPersonas.filter((p) => !personasEnLibro.some((pl) => pl.id_persona === p.id && pl.rol.id === idRol));

function AgregarExistenteDialog({
    personasEnLibro,
    todasLasPersonas,
    roles,
    onClose,
    onSave
}: {
    personasEnLibro: PersonaEnLibro[];
    todasLasPersonas: Persona[];
    roles: Rol[];
    onClose: () => void;
    onSave: (rol: Rol, idPersona: number, porcentaje: number, montoAcordado?: number) => Promise<void>;
}) {
    const [idRol, setIdRol] = useState(roles[0]?.id ?? 0);
    const disponibles = disponiblesPara(todasLasPersonas, personasEnLibro, idRol);
    const [idPersona, setIdPersona] = useState<number | "">(disponibles[0]?.id ?? "");
    const [porcentaje, setPorcentaje] = useState("0");
    const [montoAcordado, setMontoAcordado] = useState("");
    const [saving, setSaving] = useState(false);

    const handleRolChange = (nuevoId: number) => {
        setIdRol(nuevoId);
        setIdPersona(disponiblesPara(todasLasPersonas, personasEnLibro, nuevoId)[0]?.id ?? "");
    };

    const handleSave = async () => {
        const rol = roles.find((candidato) => candidato.id === idRol);
        if (idPersona === "" || !rol) return;
        setSaving(true);
        await onSave(
            rol,
            Number(idPersona),
            Number(clampRange(porcentaje, 0, 100)),
            montoAcordado.trim() === "" ? undefined : Number(montoAcordado)
        );
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
                <Select value={String(idRol)} onChange={(e) => handleRolChange(Number(e.target.value))} options={opcionesDeRol(roles)} />
            </Field>
            <Field label="Persona" style={{ marginTop: "var(--space-4)" }}>
                <Select
                    value={String(idPersona)}
                    onChange={(e) => setIdPersona(Number(e.target.value))}
                    options={disponibles.map((p) => ({ value: String(p.id), label: p.nombre }))}
                    placeholder={disponibles.length === 0 ? "No queda nadie con ese rol" : undefined}
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
            <Field
                label="Anticipo"
                style={{ marginTop: "var(--space-4)" }}
                hint="Opcional. Se cobra una sola vez al lanzar el libro; una reimpresión no genera otro."
            >
                <Input
                    type="text"
                    inputMode="decimal"
                    suffix="ARS"
                    placeholder="Sin anticipo"
                    value={montoAcordado}
                    onChange={(e) => setMontoAcordado(sanitizeDecimal(e.target.value))}
                />
            </Field>
        </Dialog>
    );
}

function AgregarNuevaDialog({
    roles,
    onClose,
    onSave
}: {
    roles: Rol[];
    onClose: () => void;
    onSave: (rol: Rol, input: CreatePersonaInput, porcentaje: number, montoAcordado?: number) => Promise<void>;
}) {
    const [idRol, setIdRol] = useState(roles[0]?.id ?? 0);
    const [inputs, setInputs] = useState({ nombre: "", email: "", dni: "", porcentaje: "0", montoAcordado: "" });
    const [saving, setSaving] = useState(false);
    const [emailTouched, setEmailTouched] = useState(false);
    const emailInvalid = emailTouched && inputs.email !== "" && !isValidEmail(inputs.email);
    const formValid = inputs.nombre.trim() !== "" && inputs.dni.trim() !== "" && (inputs.email === "" || isValidEmail(inputs.email));

    const handleSave = async (event: FormEvent) => {
        event.preventDefault();
        const rol = roles.find((candidato) => candidato.id === idRol);
        if (!rol) return;
        setSaving(true);
        await onSave(
            rol,
            { nombre: inputs.nombre, email: inputs.email, dni: inputs.dni },
            Number(clampRange(inputs.porcentaje, 0, 100)),
            inputs.montoAcordado.trim() === "" ? undefined : Number(inputs.montoAcordado)
        );
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
                    <Select value={String(idRol)} onChange={(e) => setIdRol(Number(e.target.value))} options={opcionesDeRol(roles)} />
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
                <Field
                    label="Anticipo"
                    style={{ marginTop: "var(--space-4)" }}
                    hint="Opcional. Se cobra una sola vez al lanzar el libro; una reimpresión no genera otro."
                >
                    <Input
                        type="text"
                        inputMode="decimal"
                        suffix="ARS"
                        placeholder="Sin anticipo"
                        value={inputs.montoAcordado}
                        onChange={(e) => setInputs((v) => ({ ...v, montoAcordado: sanitizeDecimal(e.target.value) }))}
                    />
                </Field>
            </form>
        </Dialog>
    );
}

// Anticipo de una fila: en reposo muestra el monto formateado ("—" si no hay)
// y al enfocarlo pasa a edición con el decimal crudo — un input con
// "$ 4.600" adentro no se puede tipear. El porcentaje de la misma fila viaja
// siempre en el PUT, así que lo aporta quien llama.
function AnticipoInput({ monto, onCommit }: { monto: number | null; onCommit: (monto: number) => Promise<void> }) {
    const [editando, setEditando] = useState(false);
    const [draft, setDraft] = useState("");
    const [saving, setSaving] = useState(false);

    const handleFocus = () => {
        setDraft(monto === null ? "" : String(monto));
        setEditando(true);
    };

    const handleBlur = async () => {
        setEditando(false);
        const raw = draft.trim();
        // Vacío = sin cambio: la API no acepta `null`, así que un anticipo ya
        // cargado no se puede borrar desde acá, sólo editar su monto.
        if (raw === "") return;
        const value = Number(raw);
        if (Number.isNaN(value) || value === monto) return;
        setSaving(true);
        await onCommit(value);
        setSaving(false);
    };

    return (
        <Input
            type="text"
            inputMode="decimal"
            suffix="ARS"
            placeholder="—"
            style={{ width: 140 }}
            disabled={saving}
            value={editando ? draft : monto === null ? "" : formatMoney(monto)}
            onFocus={handleFocus}
            onChange={(e) => setDraft(sanitizeDecimal(e.target.value))}
            onBlur={handleBlur}
        />
    );
}
