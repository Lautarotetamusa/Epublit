import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "../../lib/money";
import { ESTILO_TOOLTIP } from "./estiloTooltip";
import { PINO_600 } from "./GraficoIngresoMensual";
import type { PuntoMedioPago } from "./tipos";

export function GraficoMedioPago({ puntos }: { puntos: PuntoMedioPago[] }) {
    return (
        <ResponsiveContainer width="100%" height={260}>
            <BarChart data={puntos} layout="vertical" margin={{ top: 4, left: 8, right: 104, bottom: 4 }}>
                <CartesianGrid horizontal={false} stroke="var(--border-subtle)" />
                <XAxis
                    type="number"
                    tick={{ fontSize: 12, fill: "var(--text-muted)" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(valor: number) => valor.toLocaleString("es-AR")}
                />
                <YAxis
                    type="category"
                    dataKey="medio"
                    tick={{ fontSize: 12, fill: "var(--text-body)" }}
                    axisLine={false}
                    tickLine={false}
                    width={130}
                />
                <Tooltip formatter={(valor) => formatMoney(Number(valor))} contentStyle={ESTILO_TOOLTIP} />
                <Bar dataKey="ingreso" name="Ingreso" fill={PINO_600} radius={[0, 4, 4, 0]} maxBarSize={24}>
                    <LabelList
                        dataKey="ingreso"
                        position="right"
                        formatter={(valor) => (typeof valor === "number" ? formatMoney(valor) : String(valor ?? ""))}
                        style={{ fill: "var(--text-body)", fontSize: 12 }}
                    />
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}
