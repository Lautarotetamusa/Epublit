import { useState } from "react";
import { Alert, Badge, Button, Dialog, EmptyState, Field, Input, Switch, Table } from "../../../design-system";
import { useConfirm } from "../../../notifications/ConfirmProvider";
import { useToast } from "../../../notifications/ToastProvider";
import { formatFechaHora } from "../../../lib/fecha";
import { getErrorMessage } from "../../../lib/errors";
import type { CreateIntegracionInput, Integracion } from "../../../api/tienda";
import { useIntegraciones } from "./useIntegraciones";

// Integraciones de la tienda: cada una tiene su propia API key, su origen
// permitido y un estado activo/inactivo. La clave completa sólo existe en el
// diálogo que aparece al crearla; después sólo queda el prefijo visible.
export function IntegracionesSection() {
    const { showToast } = useToast();
    const confirm = useConfirm();
    const { integraciones, loading, error, refetch, crear, alternarActiva, revocar } = useIntegraciones();
    const [creando, setCreando] = useState(false);
    const [claveNueva, setClaveNueva] = useState<string | null>(null);
    const [guardandoId, setGuardandoId] = useState<number | null>(null);

    const handleAlternar = async (integracion: Integracion) => {
        setGuardandoId(integracion.id);
        try {
            await alternarActiva(integracion);
            showToast("success", !integracion.activa ? "Integración activada." : "Integración desactivada.");
        } catch (err) {
            showToast("error", getErrorMessage(err));
        } finally {
            setGuardandoId(null);
        }
    };

    const handleRevocar = async (integracion: Integracion) => {
        const ok = await confirm({
            title: `¿Revocar la integración «${integracion.nombre}»?`,
            description:
                "La API key deja de funcionar en el acto. La tienda o el desarrollo que la usaba no va a poder crear más pedidos.",
            confirmLabel: "Revocar integración",
            tone: "danger"
        });
        if (!ok) return;

        setGuardandoId(integracion.id);
        try {
            await revocar(integracion.id);
            showToast("success", "Integración revocada.");
        } catch (err) {
            showToast("error", getErrorMessage(err));
        } finally {
            setGuardandoId(null);
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-4)" }}>
                <p style={{ margin: 0, maxWidth: "66ch", fontSize: "var(--text-sm)", color: "var(--text-muted)", textWrap: "pretty" }}>
                    Una integración conecta la tienda o un desarrollo propio con tu catálogo y tus pedidos. Cada una tiene su propia API key y sólo
                    puede usarse desde el origen que autorices.
                </p>
                <Button iconStart="plus" onClick={() => setCreando(true)}>
                    Nueva integración
                </Button>
            </div>

            {loading ? (
                <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>Cargando integraciones…</p>
            ) : error ? (
                <Alert tone="error" title="No pudimos cargar las integraciones">
                    {error}
                    <div style={{ marginTop: "var(--space-3)" }}>
                        <Button variant="secondary" size="sm" iconStart="arrow-right" onClick={refetch}>
                            Reintentar
                        </Button>
                    </div>
                </Alert>
            ) : integraciones.length === 0 ? (
                <EmptyState
                    icon="store"
                    title="Todavía no hay integraciones"
                    description="Creá la primera para conectar tu tienda online o un desarrollo propio."
                    action={
                        <Button iconStart="plus" onClick={() => setCreando(true)}>
                            Nueva integración
                        </Button>
                    }
                />
            ) : (
                <div style={{ border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
                    <Table
                        columns={[
                            {
                                header: "Integración",
                                cell: (row: Integracion) => (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                        <span style={{ fontWeight: "var(--weight-medium)" }}>{row.nombre}</span>
                                        <span style={{ fontSize: "var(--text-2xs)", color: "var(--text-subtle)" }}>
                                            Creada el {formatFechaHora(row.creadaEn)}
                                        </span>
                                    </div>
                                )
                            },
                            {
                                header: "API key",
                                cell: (row: Integracion) => (
                                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)" }}>
                                        {row.prefijo}…
                                    </span>
                                )
                            },
                            {
                                header: "Origen permitido",
                                wrap: true,
                                cell: (row: Integracion) => (
                                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)" }}>{row.origen}</span>
                                )
                            },
                            {
                                header: "Último uso",
                                cell: (row: Integracion) =>
                                    row.ultimoUso ? formatFechaHora(row.ultimoUso) : <span style={{ color: "var(--text-subtle)" }}>Nunca</span>
                            },
                            {
                                header: "Estado",
                                cell: (row: Integracion) =>
                                    row.revocada ? (
                                        <Badge tone="error" dot>
                                            Revocada
                                        </Badge>
                                    ) : (
                                        <Switch
                                            checked={row.activa}
                                            label={row.activa ? "Activa" : "Inactiva"}
                                            disabled={guardandoId === row.id}
                                            onChange={() => handleAlternar(row)}
                                        />
                                    )
                            },
                            {
                                header: "",
                                align: "right",
                                cell: (row: Integracion) =>
                                    row.revocada ? null : (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            style={{ color: "var(--text-error)" }}
                                            onClick={() => handleRevocar(row)}
                                            disabled={guardandoId === row.id}
                                        >
                                            Revocar
                                        </Button>
                                    )
                            }
                        ]}
                        rows={integraciones}
                    />
                </div>
            )}

            <Alert tone="info" title="La API key se muestra una sola vez">
                Al crear una integración vas a ver la clave completa. Guardala en el lugar donde la va a usar tu tienda: después sólo se puede
                mostrar el prefijo. Si la perdés, revocá la integración y creá otra.
            </Alert>

            {creando ? (
                <NuevaIntegracionDialog
                    onClose={() => setCreando(false)}
                    onCreate={crear}
                    onCreated={(integracion, clave) => {
                        setCreando(false);
                        setClaveNueva(clave);
                        showToast("success", `Integración «${integracion.nombre}» creada.`);
                    }}
                />
            ) : null}

            {claveNueva ? <ClaveNuevaDialog clave={claveNueva} onClose={() => setClaveNueva(null)} /> : null}
        </div>
    );
}

function NuevaIntegracionDialog({
    onClose,
    onCreate,
    onCreated
}: {
    onClose: () => void;
    onCreate: (input: CreateIntegracionInput) => Promise<{ integracion: Integracion; apiKey: string }>;
    onCreated: (integracion: Integracion, clave: string) => void;
}) {
    const [nombre, setNombre] = useState("");
    const [origen, setOrigen] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const origenInvalido = origen.trim() !== "" && !/^https?:\/\/\S+$/i.test(origen.trim());
    const puedeCrear = nombre.trim() !== "" && origen.trim() !== "" && !origenInvalido;

    const handleCrear = async () => {
        setSaving(true);
        setError(null);
        try {
            const { integracion, apiKey } = await onCreate({ nombre: nombre.trim(), origen: origen.trim() });
            onCreated(integracion, apiKey);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog
            open
            title="Nueva integración"
            description="Conectá una tienda o un desarrollo propio con tu catálogo y tus pedidos."
            onClose={onClose}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button onClick={handleCrear} disabled={!puedeCrear} loading={saving}>
                        Crear integración
                    </Button>
                </>
            }
        >
            {error ? (
                <Alert tone="error" style={{ marginBottom: "var(--space-4)" }}>
                    {error}
                </Alert>
            ) : null}
            <Field label="Nombre" required hint="Para reconocerla en la lista, por ejemplo «Tienda propia».">
                <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tienda propia" autoFocus />
            </Field>
            <Field
                label="Origen permitido"
                required
                hint="El dominio desde el que se va a usar la API key."
                error={origenInvalido ? "Escribí una URL completa, por ejemplo https://tienda.ejemplo.com" : undefined}
                style={{ marginTop: "var(--space-4)" }}
            >
                <Input
                    type="url"
                    value={origen}
                    invalid={origenInvalido}
                    onChange={(e) => setOrigen(e.target.value)}
                    placeholder="https://tienda.ejemplo.com"
                />
            </Field>
        </Dialog>
    );
}

function ClaveNuevaDialog({ clave, onClose }: { clave: string; onClose: () => void }) {
    const { showToast } = useToast();

    const copiar = async () => {
        try {
            await navigator.clipboard.writeText(clave);
            showToast("success", "Clave copiada.");
        } catch {
            showToast("error", "No se pudo copiar. Seleccioná la clave y copiala a mano.");
        }
    };

    return (
        <Dialog
            open
            title="Guardá la API key"
            description="Esta es la única vez que vas a poder ver la clave completa."
            onClose={onClose}
            footer={
                <Button variant="secondary" onClick={onClose}>
                    Cerrar
                </Button>
            }
        >
            <Alert tone="warning" title="No la vamos a volver a mostrar">
                Copiala ahora y guardala en el lugar donde la va a usar la tienda. Si la perdés, vas a tener que revocar la integración y crear
                otra.
            </Alert>
            <Field label="API key" style={{ marginTop: "var(--space-4)" }}>
                <Input
                    readOnly
                    mono
                    value={clave}
                    onFocus={(e) => e.currentTarget.select()}
                    style={{ marginBottom: "var(--space-3)" }}
                />
                <Button variant="secondary" size="sm" onClick={copiar} style={{ alignSelf: "flex-start" }}>
                    Copiar clave
                </Button>
            </Field>
        </Dialog>
    );
}
