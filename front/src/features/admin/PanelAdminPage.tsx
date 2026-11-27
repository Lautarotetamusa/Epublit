import { useNavigate } from "react-router-dom";
import { Button, Card, EmptyState, Icon } from "../../design-system";
import { formatRango } from "../../lib/fecha";
import { useMediaQuery } from "../../lib/useMediaQuery";
import { EmbudoActivacion } from "./EmbudoActivacion";
import { EtapasAdquisicion } from "./EtapasAdquisicion";
import { ResumenCampana } from "./ResumenCampana";
import { TablaCuentas } from "./TablaCuentas";
import type { PeriodoPanel } from "./tipos";
import { usePanelAdmin } from "./usePanelAdmin";

const BREAKPOINT_ANALISIS = "(max-width: 1080px)";

function EncabezadoPanel({ periodo }: { periodo: PeriodoPanel }) {
    return (
        <div
            style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexWrap: "wrap",
                gap: "var(--space-4)"
            }}
        >
            <div style={{ minWidth: 0, maxWidth: "72ch" }}>
                <h1
                    style={{
                        margin: 0,
                        fontFamily: "var(--font-display)",
                        fontSize: "var(--text-2xl)",
                        fontWeight: "var(--weight-semibold)",
                        letterSpacing: "var(--tracking-tight)"
                    }}
                >
                    Uso del producto
                </h1>
                <p
                    style={{
                        margin: "6px 0 0",
                        fontSize: "var(--text-sm)",
                        lineHeight: "var(--leading-normal)",
                        color: "var(--text-muted)",
                        textWrap: "pretty"
                    }}
                >
                    Campaña en curso · {formatRango(periodo.desde, periodo.hasta)}. Activa = operación de
                    negocio en los últimos 30 días.
                </p>
            </div>
        </div>
    );
}

function CargandoPanel() {
    return (
        <div
            role="status"
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "var(--space-3)",
                minHeight: "50vh",
                color: "var(--text-muted)"
            }}
        >
            <Icon
                name="loader-circle"
                size={28}
                color="var(--pino-600)"
                style={{ animation: "epublit-spin 900ms linear infinite" }}
            />
            <span style={{ fontSize: "var(--text-sm)" }}>Cargando métricas…</span>
        </div>
    );
}

function EstadoDeAcceso({ onVolver }: { onVolver: () => void }) {
    return (
        <Card>
            <EmptyState
                icon="circle-alert"
                title="Acceso restringido"
                description="El panel de administración es sólo para las cuentas que operan Epublit. Si llegaste acá por error, volvé al inicio."
                action={
                    <Button variant="secondary" onClick={onVolver}>
                        Volver al inicio
                    </Button>
                }
            />
        </Card>
    );
}

function ErrorDeCarga({ onReintentar }: { onReintentar: () => void }) {
    return (
        <Card>
            <EmptyState
                icon="triangle-alert"
                title="No pudimos cargar las métricas"
                description="Revisá la conexión y volvé a intentar. Si el problema sigue, escribinos."
                action={
                    <Button variant="secondary" onClick={onReintentar}>
                        Reintentar
                    </Button>
                }
            />
        </Card>
    );
}

function PanelVacio({ periodo }: { periodo: PeriodoPanel }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <EncabezadoPanel periodo={periodo} />
            <Card>
                <EmptyState
                    icon="users"
                    title="Todavía no hay cuentas"
                    description="Cuando se registre la primera editorial, va a aparecer acá con su actividad."
                />
            </Card>
        </div>
    );
}

export function PanelAdminPage() {
    const { estado, panel, recargar } = usePanelAdmin();
    const navegar = useNavigate();
    const apilado = useMediaQuery(BREAKPOINT_ANALISIS);

    if (estado === "cargando") return <CargandoPanel />;
    if (estado === "sin-acceso") return <EstadoDeAcceso onVolver={() => navegar("/")} />;
    if (estado === "error" || !panel) return <ErrorDeCarga onReintentar={recargar} />;
    if (panel.resumen.total === 0) return <PanelVacio periodo={panel.periodo} />;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <EncabezadoPanel periodo={panel.periodo} />

            <ResumenCampana resumen={panel.resumen} />

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: apilado ? "1fr" : "minmax(0, 7fr) minmax(0, 5fr)",
                    alignItems: "stretch",
                    gap: "var(--space-6)"
                }}
            >
                <EmbudoActivacion pasos={panel.embudo} />
                <EtapasAdquisicion etapas={panel.etapas} />
            </div>

            <TablaCuentas totalCuentas={panel.resumen.total} />
        </div>
    );
}
