import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, LabelList } from "recharts";
import { Card, StatCard, Input, Field } from "../../design-system";
import { useDashboard } from "./useDashboard";

// Un solo matiz de marca (pino-600) para las dos magnitudes: son gráficos de
// una sola serie (identidad ya la da el título/eje), no categóricos — así
// evitamos necesitar una paleta categórica de 5 colores que el propio
// sistema de diseño no tiene (sólo pino/violeta/papel, ver
// design-system/readme.md) y que además no pasa el piso de croma del
// validador de la skill de dataviz (los tonos "pino" leen como gris).
const PINO_600 = "#22605D";

const formatMonto = (value: unknown): string => Number(value).toLocaleString("es-AR");

export function DashboardPage() {
    const { loading, desde, hasta, setDesde, setHasta, totalVendido, cantidadVentas, enFirme, enConsignacion, porMedioPago, porMes } =
        useDashboard();

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <Card
                title="Período"
                actions={
                    <div style={{ display: "flex", gap: "var(--space-3)" }}>
                        <Field label="Desde">
                            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
                        </Field>
                        <Field label="Hasta">
                            <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
                        </Field>
                    </div>
                }
            />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--space-4)" }}>
                <StatCard label="Monto vendido" value={loading ? "..." : `$ ${totalVendido.toLocaleString("es-AR")}`} icon="banknote" />
                <StatCard label="Ventas" value={loading ? "..." : cantidadVentas} icon="receipt-text" />
                <StatCard label="En firme" value={loading ? "..." : enFirme} icon="store" />
                <StatCard label="Sobre consignación" value={loading ? "..." : enConsignacion} icon="boxes" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-6)" }}>
                <Card title="Ventas por medio de pago">
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={porMedioPago} layout="vertical" margin={{ left: 24, right: 32 }}>
                            <CartesianGrid horizontal={false} stroke="var(--border-subtle)" />
                            <XAxis type="number" tick={{ fontSize: 12, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                            <YAxis
                                type="category"
                                dataKey="medio"
                                tick={{ fontSize: 12, fill: "var(--text-body)" }}
                                axisLine={false}
                                tickLine={false}
                                width={100}
                            />
                            <Tooltip formatter={formatMonto} />
                            <Bar dataKey="total" fill={PINO_600} radius={[0, 4, 4, 0]} maxBarSize={24}>
                                <LabelList
                                    dataKey="total"
                                    position="right"
                                    formatter={formatMonto}
                                    style={{ fill: "var(--text-body)", fontSize: 12 }}
                                />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </Card>

                <Card title="Monto mensual de ventas">
                    <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={porMes} margin={{ left: 8, right: 16 }}>
                            <CartesianGrid vertical={false} stroke="var(--border-subtle)" />
                            <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 12, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                            <Tooltip formatter={formatMonto} />
                            <Line
                                type="monotone"
                                dataKey="total"
                                stroke={PINO_600}
                                strokeWidth={2}
                                dot={{ r: 4, fill: PINO_600, stroke: "var(--papel-0)", strokeWidth: 2 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </Card>
            </div>
        </div>
    );
}
