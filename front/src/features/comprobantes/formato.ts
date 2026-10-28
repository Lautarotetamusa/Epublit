import type { ComprobanteEstado, ComprobanteResumen } from "../../api/comprobantes";
import { formatFecha } from "../../lib/fecha";

// Reglas de presentación compartidas por la ruta, las fichas y el documento.
// El backend manda fechas ISO y número ya derivados; acá sólo se traducen al
// formato de lectura del sistema (es-AR, dos decimales en el documento fiscal).

export const ESTADO_COMPROBANTE_LABEL: Record<ComprobanteEstado, string> = {
    pendiente: "Pendiente",
    emitida: "Emitida",
    error: "Error de emisión"
};

export function estadoComprobanteTone(estado: ComprobanteEstado): "warning" | "success" | "error" {
    switch (estado) {
        case "emitida":
            return "success";
        case "pendiente":
            return "warning";
        case "error":
            return "error";
    }
}

export function nombreComprobante(
    comprobante: Pick<ComprobanteResumen, "clase" | "tipo">
): string {
    if (comprobante.clase === "remito") return "Remito";
    return comprobante.tipo?.nombre ?? "Factura";
}

// El remito y la factura comparten la misma ficha; el rótulo del botón lo
// decide el tipo real del comprobante, no el tipo de movimiento.
export function etiquetaVerComprobante(
    comprobante: Pick<ComprobanteResumen, "clase">
): string {
    return comprobante.clase === "remito" ? "Ver remito" : "Ver comprobante";
}

// El backend ya manda `numeroCompleto`; se usa tal cual en pantalla para no
// duplicar la regla de ceros de factura (`00001-00000042`) y remito
// (`0003/00001`). Estas variantes sirven para las columnas sueltas del A4.
export function numeroConCeros(value: number | null, digitos: number): string {
    return value === null ? "—" : String(value).padStart(digitos, "0");
}

export function formatearFechaComprobante(fecha: string | null): string {
    if (!fecha) return "—";
    // `emisor.inicioActividades` es un snapshot histórico y puede venir ya en
    // dd/mm/yyyy; el resto de las fechas llega ISO.
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(fecha)) return fecha;
    return formatFecha(fecha);
}

// A diferencia de `formatMoney` (que omite centavos cuando el importe es
// redondo), un comprobante fiscal siempre muestra dos decimales.
export function formatearImporte(value: number): string {
    return `$ ${value.toLocaleString("es-AR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}

export function formatearCantidad(value: number): string {
    return value.toLocaleString("es-AR");
}

// El DTO tipa las observaciones de AFIP como `unknown[]`: se muestran como
// texto plano, nunca como HTML.
export function textoObservacion(observacion: unknown): string {
    if (typeof observacion === "string") return observacion;
    if (typeof observacion === "number" || typeof observacion === "boolean") {
        return String(observacion);
    }

    if (observacion !== null && typeof observacion === "object") {
        const registro = observacion as Record<string, unknown>;
        for (const clave of ["message", "mensaje", "descripcion", "texto"]) {
            if (typeof registro[clave] === "string") return registro[clave];
        }

        return JSON.stringify(observacion);
    }

    return String(observacion);
}

export function abrirComprobanteEnPestana(id: number): void {
    window.open(`/comprobantes/${id}`, "_blank", "noopener,noreferrer");
}
