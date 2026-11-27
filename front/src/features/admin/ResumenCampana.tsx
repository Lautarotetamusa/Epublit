import { Card, StatCard } from "../../design-system";
import { formatEntero, formatPorcentaje } from "../../lib/numero";
import { useMediaQuery } from "../../lib/useMediaQuery";
import type { ResumenCampana as Resumen } from "./tipos";

function porcentajeDe(parte: number, total: number): number {
    return total === 0 ? 0 : (parte / total) * 100;
}

// Seis cifras en una sola tarjeta y con la misma línea de base: la campaña se
// lee de un vistazo antes de bajar al embudo y a la tabla.
export function ResumenCampana({ resumen }: { resumen: Resumen }) {
    // Seis columnas en escritorio, tres en tablet y dos en teléfono: con
    // `auto-fit` la sexta cifra quedaba sola en una segunda fila.
    const muyAngosto = useMediaQuery("(max-width: 640px)");
    const angosto = useMediaQuery("(max-width: 1180px)");
    const columnas = muyAngosto ? 2 : angosto ? 3 : 6;

    const pctActivos = porcentajeDe(resumen.activas30d, resumen.total);
    const pctNuevas = porcentajeDe(resumen.nuevas30d, resumen.total);
    const pctLibro = porcentajeDe(resumen.conLibro, resumen.total);
    const pctVenta = porcentajeDe(resumen.conVenta, resumen.total);
    const pctArca = porcentajeDe(resumen.conArca, resumen.total);
    const total = formatEntero(resumen.total);

    const figuras: Array<{ etiqueta: string; icono: string; valor: string; detalle?: string }> = [
        {
            etiqueta: "Cuentas",
            icono: "circle-check",
            valor: total
        },
        {
            etiqueta: "Nuevas en 30 días",
            icono: "user-round",
            valor: formatEntero(resumen.nuevas30d),
            detalle: formatPorcentaje(pctNuevas)
        },
        {
            etiqueta: "Cuentas activas",
            icono: "chart-line",
            valor: formatEntero(resumen.activas30d),
            detalle: formatPorcentaje(pctActivos)
        },
        {
            etiqueta: "Con libro",
            icono: "library",
            valor: formatEntero(resumen.conLibro),
            detalle: formatPorcentaje(pctLibro)
        },
        {
            etiqueta: "Con venta",
            icono: "receipt-text",
            valor: formatEntero(resumen.conVenta),
            detalle: formatPorcentaje(pctVenta)
        },
        {
            etiqueta: "ARCA conectado",
            icono: "file-text",
            valor: formatEntero(resumen.conArca),
            detalle: formatPorcentaje(pctArca)
        }
    ];

    return (
        <Card title="Pulso de la campaña" padded={false}>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))`,
                    marginLeft: -1
                }}
            >
                {figuras.map((figura, indice) => (
                    <div
                        key={figura.etiqueta}
                        style={{
                            padding: "var(--space-4) var(--space-5)",
                            borderLeft: "1px solid var(--border-subtle)",
                            borderTop:
                                indice >= columnas ? "1px solid var(--border-subtle)" : undefined
                        }}
                    >
                        <StatCard
                            variant="bare"
                            label={figura.etiqueta}
                            value={figura.valor}
                            icon={figura.icono}
                            delta={figura.detalle}
                            deltaTone="muted"
                        />
                    </div>
                ))}
            </div>
        </Card>
    );
}
