import type { Extremo, TipoMovimiento, TipoMovimientoManual } from "../../api/deposito";

// Cómo se presenta cada movimiento. El tipo viaja explícito en el movimiento
// (ver api/deposito.ts): el historial no lo deduce de los extremos, porque una
// venta y una baja comparten depósito → exterior.
export const TIPO_MOVIMIENTO: Record<
    TipoMovimiento,
    { label: string; tono: "success" | "warning" | "brand"; icono: string; explicacion: string }
> = {
    ingreso: {
        label: "Ingreso",
        tono: "success",
        icono: "download",
        explicacion: "Entra stock desde el exterior a un depósito."
    },
    baja: {
        label: "Baja",
        tono: "warning",
        icono: "upload",
        explicacion: "Sale stock de un depósito hacia el exterior."
    },
    transferencia: {
        label: "Transferencia",
        tono: "brand",
        icono: "arrow-right",
        explicacion: "Pasa stock de un depósito a otro."
    },
    venta: {
        label: "Venta",
        tono: "success",
        icono: "banknote",
        explicacion: "Venta en firme: el stock sale del depósito principal."
    },
    consignacion: {
        label: "Consignación",
        tono: "brand",
        icono: "truck",
        explicacion: "El stock pasa al depósito de un cliente en consignación."
    },
    ventaConsignacion: {
        label: "Venta sobre consignación",
        tono: "success",
        icono: "store",
        explicacion: "Venta del stock que estaba consignado en un cliente."
    },
    devolucion: {
        label: "Devolución",
        tono: "warning",
        icono: "package",
        explicacion: "El stock consignado vuelve del cliente al depósito principal."
    }
};

// Sólo estos tres los registra el alta manual: alimentan el SegmentedControl
// del formulario (ver MovimientosPage).
export const TIPOS_MOVIMIENTO: TipoMovimientoManual[] = ["ingreso", "baja", "transferencia"];

export function nombreDeExtremo(extremo: Extremo): string {
    return extremo.tipo === "exterior" ? "Exterior" : extremo.nombre;
}

export function formatearFecha(fecha: string, conHora = false): string {
    const date = new Date(fecha);
    const dia = date.toLocaleDateString("es-AR");
    if (!conHora) return dia;
    return `${dia} · ${date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`;
}

// "3 títulos · 45 ejemplares": el resumen de un movimiento sin abrir el detalle.
export function resumirLibros(libros: { cantidad: number }[]): string {
    const ejemplares = libros.reduce((total, libro) => total + libro.cantidad, 0);
    const titulos = libros.length === 1 ? "1 título" : `${libros.length} títulos`;
    return `${titulos} · ${ejemplares} ${ejemplares === 1 ? "ejemplar" : "ejemplares"}`;
}
