import type { Extremo, Movimiento, TipoMovimiento } from "../../api/deposito";

// Cómo se presenta un movimiento. El tipo NO se guarda: se deriva de sus
// extremos, que es lo único que lo define (ver api/deposito.ts). Así el
// historial no puede quedar con un tipo que contradiga su origen y destino.
export function tipoDe(movimiento: Pick<Movimiento, "origen" | "destino">): TipoMovimiento {
    if (movimiento.origen.tipo === "exterior") return "ingreso";
    if (movimiento.destino.tipo === "exterior") return "baja";
    return "transferencia";
}

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
    }
};

export const TIPOS_MOVIMIENTO: TipoMovimiento[] = ["ingreso", "baja", "transferencia"];

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
