import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Badge, Button, Icon } from "../../../design-system";
import { useConfirm } from "../../../notifications/ConfirmProvider";
import { useToast } from "../../../notifications/ToastProvider";
import { formatFechaHora } from "../../../lib/fecha";
import { getErrorMessage } from "../../../lib/errors";
import { useMercadoPago } from "./useMercadoPago";

// Checkout Pro se conecta por OAuth: la pantalla sólo muestra el estado de la
// conexión y los datos de la cuenta, nunca credenciales de MercadoPago. El
// botón conectar manda a la URL de autorización real que devuelve el backend.
export function MercadoPagoSection() {
    const { showToast } = useToast();
    const confirm = useConfirm();
    const [searchParams, setSearchParams] = useSearchParams();
    const { status, loading, error, refetch, conectar, desconectar } = useMercadoPago();
    const [conectando, setConectando] = useState(false);
    const [desconectando, setDesconectando] = useState(false);

    // El callback de OAuth vuelve a `/tienda?mercadopago=conectado`. Se
    // muestra el aviso, se limpia el query param y se relee el estado real.
    useEffect(() => {
        if (searchParams.get("mercadopago") !== "conectado") return;

        showToast("success", "MercadoPago conectado. Ya podés cobrar en la tienda.");
        const siguiente = new URLSearchParams(searchParams);
        siguiente.delete("mercadopago");
        setSearchParams(siguiente, { replace: true });
        refetch();
    }, [searchParams, setSearchParams, showToast, refetch]);

    const handleConectar = async () => {
        setConectando(true);
        try {
            await conectar();
        } catch (err) {
            showToast("error", getErrorMessage(err));
            setConectando(false);
        }
    };

    const handleDesconectar = async () => {
        const ok = await confirm({
            title: "¿Desconectar MercadoPago?",
            description: "La tienda deja de poder cobrar con Checkout Pro hasta que vuelvas a conectar la cuenta.",
            confirmLabel: "Desconectar",
            tone: "danger"
        });
        if (!ok) return;

        setDesconectando(true);
        try {
            await desconectar();
            showToast("success", "MercadoPago desconectado.");
        } catch (err) {
            showToast("error", getErrorMessage(err));
        } finally {
            setDesconectando(false);
        }
    };

    if (loading) {
        return <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>Cargando el estado de MercadoPago…</p>;
    }

    if (error || !status) {
        return (
            <Alert tone="error" title="No pudimos cargar MercadoPago">
                {error ?? "No se pudo leer el estado de la conexión."}
                <div style={{ marginTop: "var(--space-3)" }}>
                    <Button variant="secondary" size="sm" iconStart="arrow-right" onClick={refetch}>
                        Reintentar
                    </Button>
                </div>
            </Alert>
        );
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-5)" }}>
                <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "flex-start" }}>
                    <span
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 44,
                            height: 44,
                            flex: "0 0 auto",
                            borderRadius: "var(--radius-pill)",
                            background: "var(--surface-accent-soft)",
                            border: "1px solid var(--violeta-100)"
                        }}
                    >
                        <Icon name="banknote" size={20} color="var(--violeta-700)" />
                    </span>
                    <div>
                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-3)" }}>
                            <h4 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-md)", fontWeight: "var(--weight-semibold)" }}>
                                MercadoPago Checkout Pro
                            </h4>
                            <Badge tone={status.conectado ? "success" : "neutral"} dot>
                                {status.conectado ? "Conectada" : "Sin conectar"}
                            </Badge>
                        </div>
                        <p style={{ margin: "6px 0 0", maxWidth: "62ch", fontSize: "var(--text-sm)", color: "var(--text-muted)", textWrap: "pretty" }}>
                            Los compradores pagan con MercadoPago y vuelven a la tienda. El pedido entra a Epublit cuando el pago queda aprobado.
                        </p>
                    </div>
                </div>

                {status.conectado ? (
                    <Button variant="secondary" onClick={handleDesconectar} loading={desconectando}>
                        Desconectar
                    </Button>
                ) : (
                    <Button variant="accent" iconStart="external-link" onClick={handleConectar} loading={conectando}>
                        Conectar MercadoPago
                    </Button>
                )}
            </div>

            {status.conectado ? (
                <dl
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                        gap: "var(--space-4)",
                        margin: 0,
                        padding: "var(--space-4) var(--space-5)",
                        background: "var(--papel-50)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "var(--radius-md)"
                    }}
                >
                    <Dato label="Cuenta">{status.alias || "—"}</Dato>
                    <Dato label="Email">{status.email || "—"}</Dato>
                    <Dato label="Aplicación" mono>
                        {status.aplicacionId || "—"}
                    </Dato>
                    <Dato label="Conectada el">{status.conectadoEl ? formatFechaHora(status.conectadoEl) : "—"}</Dato>
                </dl>
            ) : null}

            <Alert tone="info" title={status.conectado ? "Los cobros van directo a tu cuenta" : "Cómo se conecta"}>
                {status.conectado
                    ? "Epublit recibe la confirmación del pago y arma el pedido. La plata se acredita en tu cuenta de MercadoPago según sus plazos."
                    : "Al conectar, te llevamos a MercadoPago para autorizar la aplicación. Volvés a Epublit con la conexión lista; no hace falta pegar credenciales."}
            </Alert>
        </div>
    );
}

function Dato({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
    return (
        <div>
            <dt
                style={{
                    fontSize: "var(--text-2xs)",
                    textTransform: "uppercase",
                    letterSpacing: "var(--tracking-caps)",
                    color: "var(--text-muted)"
                }}
            >
                {label}
            </dt>
            <dd
                style={{
                    margin: "4px 0 0",
                    fontFamily: mono ? "var(--font-mono)" : undefined,
                    fontSize: mono ? "var(--text-xs)" : undefined,
                    wordBreak: "break-word"
                }}
            >
                {children}
            </dd>
        </div>
    );
}
