import { useState } from "react";
import type { ReactNode } from "react";
import { Card, Avatar, Button, Badge, Checkbox, Dialog, Field, Input, Select } from "../../design-system";
import { usePerfil } from "./usePerfil";
import { useAuth } from "../../auth/AuthContext";
import { useToast } from "../../notifications/ToastProvider";
import { useConfirm } from "../../notifications/ConfirmProvider";
import { getErrorMessage } from "../../lib/errors";
import { FullscreenSpinner } from "../../components/FullscreenSpinner";
import { sanitizeInteger, sanitizeDecimal } from "../../lib/numericInput";
import { isValidEmail } from "../../lib/validation";

export function PerfilPage() {
    const { user, loading, update, refreshFromAfip } = usePerfil();
    const { logout } = useAuth();
    const { showToast } = useToast();
    const confirm = useConfirm();
    const [showEdit, setShowEdit] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Traer el padrón pisa los datos fiscales cargados a mano, así que se
    // confirma antes (incluida la condición frente al IVA).
    const handleRefreshAfip = async () => {
        const ok = await confirm({
            title: "¿Actualizar los datos desde AFIP?",
            description:
                "Se reemplazan la condición frente al IVA, la razón social, el domicilio, Ingresos Brutos y la fecha de inicio por los datos del padrón de AFIP para tu CUIT.",
            confirmLabel: "Actualizar"
        });
        if (!ok) return;

        setRefreshing(true);
        try {
            await refreshFromAfip();
            showToast("success", "Datos actualizados desde AFIP");
        } catch (err) {
            showToast("error", getErrorMessage(err));
        } finally {
            setRefreshing(false);
        }
    };

    if (loading || !user) return <FullscreenSpinner />;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", maxWidth: 640 }}>
            <Card
                actions={
                    <>
                        <Button variant="secondary" iconStart="download" onClick={handleRefreshAfip} loading={refreshing}>
                            Traer de AFIP
                        </Button>
                        <Button variant="secondary" iconStart="pencil" onClick={() => setShowEdit(true)}>
                            Editar perfil
                        </Button>
                        <Button variant="danger" iconStart="log-out" onClick={logout}>
                            Cerrar sesión
                        </Button>
                    </>
                }
            >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", marginBottom: "var(--space-5)" }}>
                    <Avatar name={user.razon_social || user.username} size="lg" />
                    <div>
                        <h2 style={{ margin: 0, fontFamily: "var(--font-display)" }}>{user.username}</h2>
                        <p style={{ margin: 0, color: "var(--text-muted)" }}>{user.razon_social}</p>
                    </div>
                </div>

                <dl style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
                    <Detalle label="CUIT" value={user.cuit} />
                    <Detalle label="Condición fiscal" value={<Badge tone="brand">{user.cond_fiscal}</Badge>} />
                    <Detalle label="Domicilio" value={user.domicilio} />
                    <Detalle label="Email" value={user.email || "-"} />
                    <Detalle label="Punto de venta" value={user.punto_venta ? <Badge tone="brand">{user.punto_venta}</Badge> : "-"} />
                    <Detalle label="Ingresos brutos" value={user.ingresos_brutos ? "Sí" : "No"} />
                    <Detalle label="Inicio de actividades" value={user.fecha_inicio || "-"} />
                </dl>

                {showEdit ? (
                    <EditarPerfilDialog
                        user={user}
                        onClose={() => setShowEdit(false)}
                        onSave={async (input) => {
                            try {
                                await update(input);
                                setShowEdit(false);
                                showToast("success", "Perfil actualizado correctamente");
                            } catch (err) {
                                showToast("error", getErrorMessage(err));
                            }
                        }}
                    />
                ) : null}
            </Card>

            <RestriccionesFotoCard
                user={user}
                onSave={async (input) => {
                    try {
                        await update(input);
                        showToast("success", "Restricciones actualizadas correctamente");
                    } catch (err) {
                        showToast("error", getErrorMessage(err));
                    }
                }}
            />
        </div>
    );
}

function Detalle({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div>
            <dt style={{ fontSize: "var(--text-2xs)", textTransform: "uppercase", letterSpacing: "var(--tracking-caps)", color: "var(--text-muted)" }}>
                {label}
            </dt>
            <dd style={{ margin: "4px 0 0" }}>{value}</dd>
        </div>
    );
}

// Condiciones frente al IVA que ofrece el panel. Tienen que coincidir con
// `back/src/lib/afip/fiscal.ts#CONDICIONES_IVA`; los valores viejos del padrón
// ("RESPONSABLE INSCRIPTO") se normalizan a la opción canónica.
const CONDICIONES_IVA = [
    "IVA Responsable Inscripto",
    "IVA Responsable no Inscripto",
    "IVA Exento",
    "Monotributo",
    "Consumidor Final",
    "Sujeto No Categorizado"
] as const;

const normalizarCondicion = (valor: string): string =>
    valor
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase();

const condicionCanonica = (actual: string): string =>
    CONDICIONES_IVA.find((condicion) => normalizarCondicion(condicion) === normalizarCondicion(actual)) ?? actual;

type DatosEmisor = {
    email: string | null;
    punto_venta: number | null;
    cond_fiscal: string;
    razon_social: string;
    domicilio: string;
    ingresos_brutos: boolean;
    fecha_inicio: string;
};

function EditarPerfilDialog({
    user,
    onClose,
    onSave
}: {
    user: DatosEmisor;
    onClose: () => void;
    onSave: (input: {
        email: string;
        punto_venta: number;
        cond_fiscal: string;
        razon_social: string;
        domicilio: string;
        ingresos_brutos: boolean;
        fecha_inicio: string;
    }) => Promise<void>;
}) {
    const [email, setEmail] = useState(user.email ?? "");
    const [puntoVenta, setPuntoVenta] = useState(String(user.punto_venta ?? ""));
    const [condFiscal, setCondFiscal] = useState(condicionCanonica(user.cond_fiscal));
    const [razonSocial, setRazonSocial] = useState(user.razon_social);
    const [domicilio, setDomicilio] = useState(user.domicilio);
    const [ingresosBrutos, setIngresosBrutos] = useState(user.ingresos_brutos);
    const [fechaInicio, setFechaInicio] = useState(user.fecha_inicio);
    const [saving, setSaving] = useState(false);
    const [emailTouched, setEmailTouched] = useState(false);
    const emailInvalid = emailTouched && email !== "" && !isValidEmail(email);
    const opcionesCondicion = CONDICIONES_IVA.includes(condFiscal as (typeof CONDICIONES_IVA)[number])
        ? CONDICIONES_IVA
        : [condFiscal, ...CONDICIONES_IVA];

    const handleSave = async () => {
        setSaving(true);
        await onSave({
            email,
            punto_venta: Number(puntoVenta),
            cond_fiscal: condFiscal,
            razon_social: razonSocial,
            domicilio,
            ingresos_brutos: ingresosBrutos,
            fecha_inicio: fechaInicio
        });
        setSaving(false);
    };

    return (
        <Dialog
            open
            title="Editar perfil"
            width={560}
            onClose={onClose}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSave} loading={saving} disabled={emailInvalid}>
                        Guardar cambios
                    </Button>
                </>
            }
        >
            <Field label="Email" error={emailInvalid ? "Ingresá un email válido" : undefined}>
                <Input
                    type="email"
                    invalid={emailInvalid}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => setEmailTouched(true)}
                />
            </Field>
            <Field label="Punto de venta" style={{ marginTop: "var(--space-4)" }}>
                <Input type="text" inputMode="numeric" value={puntoVenta} onChange={(e) => setPuntoVenta(sanitizeInteger(e.target.value))} />
            </Field>

            <hr style={{ margin: "var(--space-5) 0", border: 0, borderTop: "1px solid var(--border-subtle)" }} />

            <p style={{ margin: "0 0 var(--space-4)", fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                Datos fiscales del emisor. La condición frente al IVA define qué comprobantes se emiten: Monotributo y IVA Exento
                emiten Factura C; Responsable Inscripto emite A a otro inscripto y B al resto.
            </p>

            <Field label="Condición frente al IVA" required>
                <Select value={condFiscal} onChange={(e) => setCondFiscal(e.target.value)} options={[...opcionesCondicion]} />
            </Field>
            <Field label="Razón social" style={{ marginTop: "var(--space-4)" }} required>
                <Input value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} />
            </Field>
            <Field label="Domicilio" style={{ marginTop: "var(--space-4)" }} required>
                <Input value={domicilio} onChange={(e) => setDomicilio(e.target.value)} />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", marginTop: "var(--space-4)", alignItems: "end" }}>
                <Field label="Inicio de actividades" hint="dd/mm/aaaa">
                    <Input value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} maxLength={10} />
                </Field>
                <div style={{ paddingBottom: "10px" }}>
                    <Checkbox label="Inscripto en Ingresos Brutos" checked={ingresosBrutos} onChange={(e) => setIngresosBrutos(e.target.checked)} />
                </div>
            </div>
        </Dialog>
    );
}

// Restricciones para la foto de las personas (ver PhotoUpload en el
// sistema de diseño): viven acá, editables por la editorial, en vez de
// fijas en el componente — así una editorial puede pedir fotos más livianas
// o de mayor resolución sin que alguien toque código (ver "Datos
// necesarios" en specs/004-persona-foto-bio/design.md).
type RestriccionesFoto = { fotoPersonaMaxSizeMb: number | null; fotoPersonaMinAnchoPx: number | null; fotoPersonaMinAltoPx: number | null };

function RestriccionesFotoCard({ user, onSave }: { user: RestriccionesFoto; onSave: (input: RestriccionesFoto) => Promise<void> }) {
    const [showEdit, setShowEdit] = useState(false);

    return (
        <Card
            title="Restricciones de fotos"
            subtitle="Se aplican al subir la foto de una persona."
            actions={
                <Button variant="secondary" size="sm" iconStart="pencil" onClick={() => setShowEdit(true)}>
                    Editar restricciones
                </Button>
            }
        >
            <dl style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-4)" }}>
                <Detalle label="Tamaño máximo" value={user.fotoPersonaMaxSizeMb ? `${user.fotoPersonaMaxSizeMb} MB` : "Sin límite"} />
                <Detalle label="Ancho mínimo" value={user.fotoPersonaMinAnchoPx ? `${user.fotoPersonaMinAnchoPx} px` : "Sin límite"} />
                <Detalle label="Alto mínimo" value={user.fotoPersonaMinAltoPx ? `${user.fotoPersonaMinAltoPx} px` : "Sin límite"} />
            </dl>

            {showEdit ? (
                <EditarRestriccionesFotoDialog
                    user={user}
                    onClose={() => setShowEdit(false)}
                    onSave={async (input) => {
                        await onSave(input);
                        setShowEdit(false);
                    }}
                />
            ) : null}
        </Card>
    );
}

function EditarRestriccionesFotoDialog({
    user,
    onClose,
    onSave
}: {
    user: RestriccionesFoto;
    onClose: () => void;
    onSave: (input: RestriccionesFoto) => Promise<void>;
}) {
    const [maxSizeMb, setMaxSizeMb] = useState(String(user.fotoPersonaMaxSizeMb ?? ""));
    const [minAnchoPx, setMinAnchoPx] = useState(String(user.fotoPersonaMinAnchoPx ?? ""));
    const [minAltoPx, setMinAltoPx] = useState(String(user.fotoPersonaMinAltoPx ?? ""));
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        await onSave({
            fotoPersonaMaxSizeMb: maxSizeMb === "" ? null : Number(maxSizeMb),
            fotoPersonaMinAnchoPx: minAnchoPx === "" ? null : Number(minAnchoPx),
            fotoPersonaMinAltoPx: minAltoPx === "" ? null : Number(minAltoPx)
        });
        setSaving(false);
    };

    return (
        <Dialog
            open
            title="Restricciones de fotos"
            onClose={onClose}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSave} loading={saving}>
                        Guardar cambios
                    </Button>
                </>
            }
        >
            <Field label="Tamaño máximo" hint="En MB. Vacío es sin límite.">
                <Input type="text" inputMode="decimal" suffix="MB" value={maxSizeMb} onChange={(e) => setMaxSizeMb(sanitizeDecimal(e.target.value))} />
            </Field>
            <Field label="Ancho mínimo" style={{ marginTop: "var(--space-4)" }} hint="En píxeles. Vacío es sin límite.">
                <Input type="text" inputMode="numeric" suffix="px" value={minAnchoPx} onChange={(e) => setMinAnchoPx(sanitizeInteger(e.target.value))} />
            </Field>
            <Field label="Alto mínimo" style={{ marginTop: "var(--space-4)" }} hint="En píxeles. Vacío es sin límite.">
                <Input type="text" inputMode="numeric" suffix="px" value={minAltoPx} onChange={(e) => setMinAltoPx(sanitizeInteger(e.target.value))} />
            </Field>
        </Dialog>
    );
}
