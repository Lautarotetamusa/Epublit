import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "../../lib/money";
import { ESTILO_TOOLTIP } from "./estiloTooltip";
import { formatEjemplares, formatPorcentaje } from "./formato";
import type { FilaDimension, Metrica } from "./tipos";

// Mismo criterio que el resto del panel: un solo matiz de marca porque es un
// gráfico de una serie (la identidad ya la dan el título y el eje), así no hay
// que inventar una paleta categórica que el sistema de diseño no tiene.
const PINO_600 = "#22605D";

// El ranking completo está en la tabla de abajo; el gráfico muestra los diez
// que explican el período.
export const TOP = 10;

// El eje de categorías no recorta solo: un título largo se come el gráfico.
const LARGO_ETIQUETA = 34;

// Espacio reservado a la derecha del último tramo de barra para que la etiqueta
// entre: el número con el ingreso es más ancho que el de ejemplares.
const MARGEN_ETIQUETA: Record<Metrica, number> = { ejemplares: 118, ingreso: 168 };

type Punto = {
    etiqueta: string;
    valor: number;
    texto: string;
    ejemplares: number;
    ingreso: number;
    porcentajeEjemplares: number;
    porcentajeIngreso: number;
};

function recortar(texto: string): string {
    return texto.length > LARGO_ETIQUETA ? `${texto.slice(0, LARGO_ETIQUETA - 1)}…` : texto;
}

// La etiqueta de la barra lleva la magnitud elegida y su porción del total, que
// es lo que pide el panel: cantidad y porcentaje de un vistazo.
function textoDe(fila: FilaDimension, metrica: Metrica): string {
    return metrica === "ejemplares"
        ? `${formatEjemplares(fila.ejemplares)} · ${formatPorcentaje(fila.porcentajeEjemplares)}`
        : `${formatMoney(fila.ingreso)} · ${formatPorcentaje(fila.porcentajeIngreso)}`;
}

// El tooltip es la superficie donde el cruce se lee entero: cuántos ejemplares y
// cuánto ingreso, con las dos porciones.
function detalleDe(punto: Punto): string {
    return `${formatEjemplares(punto.ejemplares)} (${formatPorcentaje(punto.porcentajeEjemplares)} del total) · ${formatMoney(
        punto.ingreso
    )} (${formatPorcentaje(punto.porcentajeIngreso)} del ingreso)`;
}

export function GraficoTopDimension({ filas, metrica }: { filas: FilaDimension[]; metrica: Metrica }) {
    const datos: Punto[] = filas.slice(0, TOP).map((fila) => ({
        etiqueta: fila.etiqueta,
        valor: metrica === "ejemplares" ? fila.ejemplares : fila.ingreso,
        texto: textoDe(fila, metrica),
        ejemplares: fila.ejemplares,
        ingreso: fila.ingreso,
        porcentajeEjemplares: fila.porcentajeEjemplares,
        porcentajeIngreso: fila.porcentajeIngreso
    }));

    return (
        <ResponsiveContainer width="100%" height={Math.max(240, datos.length * 36)}>
            <BarChart
                data={datos}
                layout="vertical"
                margin={{ top: 4, left: 8, right: MARGEN_ETIQUETA[metrica], bottom: 4 }}
            >
                <CartesianGrid horizontal={false} stroke="var(--border-subtle)" />
                <XAxis
                    type="number"
                    tick={{ fontSize: 12, fill: "var(--text-muted)" }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                    tickFormatter={(valor: number) => (metrica === "ingreso" ? valor.toLocaleString("es-AR") : String(valor))}
                />
                <YAxis
                    type="category"
                    dataKey="etiqueta"
                    tickFormatter={recortar}
                    tick={{ fontSize: 12, fill: "var(--text-body)" }}
                    axisLine={false}
                    tickLine={false}
                    width={220}
                />
                {/* El nombre completo (sin recortar) sólo se lee acá: es el
                    lugar donde el nombre del eje no entra. */}
                <Tooltip formatter={(_valor, _nombre, item) => detalleDe(item.payload as Punto)} contentStyle={ESTILO_TOOLTIP} />
                <Bar dataKey="valor" fill={PINO_600} radius={[0, 4, 4, 0]} maxBarSize={22}>
                    <LabelList dataKey="texto" position="right" style={{ fill: "var(--text-body)", fontSize: 12 }} />
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}
