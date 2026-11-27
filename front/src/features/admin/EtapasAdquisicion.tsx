import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipContentProps } from "recharts";
import { Card, EmptyState } from "../../design-system";
import { formatMes } from "../../lib/fecha";
import { ESTILO_TOOLTIP } from "../../lib/estiloTooltip";
import { formatEntero, formatPorcentaje } from "../../lib/numero";
import type { PuntoEtapas } from "./tipos";

// Etapas ordenadas de menor a mayor profundidad. La escala es secuencial, así
// que usa tres pasos de pino en vez de una paleta categórica: el color sigue
// el orden de la etapa, no la identidad de una serie suelta.
const ETAPAS = [
    {
        nombre: "Solo registrado",
        color: "#B5D5D2",
        borde: "#8CC3BF",
        cantidad: "soloRegistrado",
        porcentaje: "soloRegistradoPct"
    },
    {
        nombre: "Cargó libros",
        color: "#4F9E99",
        borde: "#4F9E99",
        cantidad: "conLibros",
        porcentaje: "conLibrosPct"
    },
    {
        nombre: "Cargó movimientos",
        color: "#22605D",
        borde: "#22605D",
        cantidad: "conMovimientos",
        porcentaje: "conMovimientosPct"
    }
] as const;

function Leyenda() {
    return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-4)", marginBottom: "var(--space-3)" }}>
            {ETAPAS.map((etapa) => (
                <span
                    key={etapa.nombre}
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: "var(--text-xs)",
                        color: "var(--text-muted)"
                    }}
                >
                    <span
                        style={{
                            width: 10,
                            height: 10,
                            borderRadius: "var(--radius-xs)",
                            background: etapa.color,
                            border: `1px solid ${etapa.borde}`
                        }}
                    />
                    {etapa.nombre}
                </span>
            ))}
        </div>
    );
}

// El eje y las áreas se dibujan en porcentaje; el tooltip recupera las
// cantidades del payload y las ordena de menor a mayor etapa, igual que la
// leyenda y el apilado.
function ContenidoTooltip({ active, payload }: TooltipContentProps) {
    const punto = payload?.[0]?.payload as PuntoEtapas | undefined;
    if (!active || !punto) return null;

    return (
        <div style={{ ...ESTILO_TOOLTIP, minWidth: 210 }}>
            <div style={{ fontWeight: "var(--weight-semibold)", color: "var(--text-body)" }}>
                {formatMes(punto.mes)}
            </div>
            <div style={{ fontSize: "var(--text-2xs)", color: "var(--text-muted)", marginBottom: 6 }}>
                {formatEntero(punto.total)} cuentas
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {ETAPAS.map((etapa) => (
                    <div
                        key={etapa.nombre}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "var(--space-4)",
                            fontSize: "var(--text-xs)"
                        }}
                    >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <span
                                style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: "var(--radius-xs)",
                                    background: etapa.color,
                                    border: `1px solid ${etapa.borde}`
                                }}
                            />
                            {etapa.nombre}
                        </span>
                        <span
                            style={{
                                fontFamily: "var(--font-mono)",
                                fontVariantNumeric: "tabular-nums",
                                color: "var(--text-body)"
                            }}
                        >
                            {formatEntero(punto[etapa.cantidad])} · {formatPorcentaje(punto[etapa.porcentaje])}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function EtapasAdquisicion({ etapas }: { etapas: PuntoEtapas[] }) {
    const hayDatos = etapas.some((punto) => punto.total > 0);

    return (
        <Card
            title="Etapas de adquisición"
            subtitle="Etapa máxima alcanzada, mes a mes."
        >
            {hayDatos ? (
                <>
                    <Leyenda />
                    <ResponsiveContainer width="100%" height={230}>
                        <AreaChart data={etapas} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                            <CartesianGrid vertical={false} stroke="var(--border-subtle)" />
                            <XAxis
                                dataKey="etiqueta"
                                tick={{ fontSize: 12, fill: "var(--text-muted)" }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                domain={[0, 100]}
                                ticks={[0, 25, 50, 75, 100]}
                                width={40}
                                tick={{ fontSize: 12, fill: "var(--text-muted)" }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(valor: number) => `${valor}%`}
                            />
                            <Tooltip
                                content={(props) => <ContenidoTooltip {...props} />}
                                cursor={{ stroke: "var(--border-default)", strokeWidth: 1 }}
                            />
                            {ETAPAS.map((etapa) => (
                                <Area
                                    key={etapa.nombre}
                                    type="monotone"
                                    dataKey={etapa.porcentaje}
                                    name={etapa.nombre}
                                    stackId="etapas"
                                    stroke={etapa.borde}
                                    strokeWidth={1}
                                    fill={etapa.color}
                                    fillOpacity={1}
                                    isAnimationActive={false}
                                />
                            ))}
                        </AreaChart>
                    </ResponsiveContainer>
                </>
            ) : (
                <EmptyState
                    icon="chart-column"
                    title="Todavía no hay historial"
                    description="Cuando haya cuentas y actividad, acá se ve cómo se compone la base mes a mes."
                />
            )}
        </Card>
    );
}
