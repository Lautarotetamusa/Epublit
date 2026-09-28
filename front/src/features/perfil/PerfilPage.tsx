import { useState } from "react";
import type { ReactNode } from "react";
import { Card, Avatar, Button, Badge, Dialog, Field, Input } from "../../design-system";
import { usePerfil } from "./usePerfil";
import { useAuth } from "../../auth/AuthContext";
import { useToast } from "../../notifications/ToastProvider";
import { getErrorMessage } from "../../lib/errors";
import { FullscreenSpinner } from "../../components/FullscreenSpinner";
import { sanitizeInteger, sanitizeDecimal } from "../../lib/numericInput";
import { isValidEmail } from "../../lib/validation";

export function PerfilPage() {
    const { user, loading, update } = usePerfil();
    const { logout } = useAuth();
    const { showToast } = useToast();
    const [showEdit, setShowEdit] = useState(false);

    if (loading || !user) return <FullscreenSpinner />;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", maxWidth: 640 }}>
            <Card
                actions={
                    <>
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

function EditarPerfilDialog({
    user,
    onClose,
    onSave
}: {
    user: { email: string | null; punto_venta: number | null };
    onClose: () => void;
    onSave: (input: { email: string; punto_venta: number }) => Promise<void>;
}) {
    const [email, setEmail] = useState(user.email ?? "");
    const [puntoVenta, setPuntoVenta] = useState(String(user.punto_venta ?? ""));
    const [saving, setSaving] = useState(false);
    const [emailTouched, setEmailTouched] = useState(false);
    const emailInvalid = emailTouched && email !== "" && !isValidEmail(email);

    const handleSave = async () => {
        setSaving(true);
        await onSave({ email, punto_venta: Number(puntoVenta) });
        setSaving(false);
    };

    return (
        <Dialog
            open
            title="Editar perfil"
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
        </Dialog>
    );
}

// Restricciones para la foto de autores/ilustradores (ver PhotoUpload en el
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
            subtitle="Se aplican al subir la foto de un autor o ilustrador."
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
