import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "../../lib/money";
import { ESTILO_TOOLTIP } from "./estiloTooltip";
import type { PuntoMensual } from "./tipos";

// Un solo matiz de marca (pino-600) para todas las series: cada gráfico tiene
// una sola serie y la identidad ya la dan el título y el eje (ver
// design-system/readme.md: el sistema no tiene una paleta categórica).
export const PINO_600 = "#22605D";

type PropsPunto = {
    cx?: number;
    cy?: number;
    payload?: PuntoMensual;
    // Inyectado al clonar el elemento (ver el `dot` de la Line).
    mesElegido?: string;
};

// El mes que se está mirando en el resto del panel se marca más grande: el
// gráfico muestra doce meses y sin esa marca no se sabe cuál de los doce puntos
// es el que corresponde a las cifras de arriba.
function PuntoDestacado({ cx, cy, payload, mesElegido }: PropsPunto) {
    const activo = payload?.mes === mesElegido;
    return <circle cx={cx} cy={cy} r={activo ? 5 : 3} fill={PINO_600} stroke="var(--papel-0)" strokeWidth={2} />;
}

export function GraficoIngresoMensual({ puntos, mesElegido }: { puntos: PuntoMensual[]; mesElegido: string }) {
    // Con doce meses, mostrar todas las etiquetas del eje las hace chocar entre
    // sí: se muestra una de cada tantas según cuántos meses haya.
    const intervalo = Math.max(0, Math.ceil(puntos.length / 8) - 1);

    return (
        <ResponsiveContainer width="100%" height={260}>
            <LineChart data={puntos} margin={{ top: 8, left: 8, right: 16 }}>
                <CartesianGrid vertical={false} stroke="var(--border-subtle)" />
                <XAxis
                    dataKey="etiqueta"
                    interval={intervalo}
                    tick={{ fontSize: 12, fill: "var(--text-muted)" }}
                    axisLine={false}
                    tickLine={false}
                />
                <YAxis
                    tick={{ fontSize: 12, fill: "var(--text-muted)" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(valor: number) => valor.toLocaleString("es-AR")}
                />
                <Tooltip formatter={(valor) => formatMoney(Number(valor))} contentStyle={ESTILO_TOOLTIP} />
                <Line
                    type="monotone"
                    dataKey="ingreso"
                    name="Ingreso"
                    stroke={PINO_600}
                    strokeWidth={2}
                    dot={<PuntoDestacado mesElegido={mesElegido} />}
                    activeDot={{ r: 5, fill: PINO_600, stroke: "var(--papel-0)", strokeWidth: 2 }}
                />
            </LineChart>
        </ResponsiveContainer>
    );
}
