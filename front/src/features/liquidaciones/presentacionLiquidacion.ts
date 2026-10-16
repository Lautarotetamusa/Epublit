import type { EstadoPago } from "../../api/liquidaciones";

// Etiqueta y tono del estado de pago, compartidos entre el listado, la ficha y
// las filas por persona: los tres lugares dicen lo mismo con el mismo badge. El
// estado en sí lo deriva el backend de los pagos vigentes; acá sólo se viste.
export const etiquetaEstado = (estado: EstadoPago): string =>
    estado === "pagada" ? "Pagada" : estado === "parcial" ? "Parcial" : "Pendiente";

export const tonoEstado = (estado: EstadoPago): "success" | "warning" | "neutral" =>
    estado === "pagada" ? "success" : estado === "parcial" ? "warning" : "neutral";

export function porcentajePagado(total: number, pagado: number): number {
    if (total <= 0) return 0;
    return Math.min(100, Math.round((pagado / total) * 100));
}

export const hoyISO = (): string => new Date().toISOString().slice(0, 10);

// Primer día del mes en curso, como período por defecto al generar.
export const primerDiaDelMes = (): string => {
    const hoy = new Date();
    return new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10);
};
