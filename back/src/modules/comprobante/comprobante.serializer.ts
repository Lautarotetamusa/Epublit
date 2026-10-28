import QRCode from "qrcode";
import {
    ComprobanteEstado,
    ComprobanteItemSnapshot,
    ComprobanteTipo,
    CODIGO_AFIP_POR_TIPO,
    FacturaResultado
} from "./comprobante.schema";
import type { ComprobanteConFactura, ComprobanteResumenRow } from "./comprobante.repository";

export type ComprobanteTipoDTO = {
    codigo: number;
    letra: string;
    nombre: string;
};

export type ComprobanteResumen = {
    id: number;
    clase: "factura" | "remito";
    estado: ComprobanteEstado;
    tipo: ComprobanteTipoDTO | null;
    numero: number | null;
    numeroCompleto: string | null;
    fecha: string | null;
};

export type ComprobanteImportesDTO = {
    subtotal: number;
    envio: number;
    descuento: number;
    neto: number;
    iva: number;
    exento: number;
    noGravado: number;
    tributos: number;
    total: number;
};

export type ComprobanteDTO = ComprobanteResumen & {
    plantillaVersion: number;
    puntoVenta: number;
    cae: string | null;
    caeVencimiento: string | null;
    resultado: FacturaResultado | null;
    observaciones: unknown[];
    moneda: string;
    importes: ComprobanteImportesDTO;
    emisor: ComprobanteConFactura["comprobante"]["emisor"];
    receptor: ComprobanteConFactura["comprobante"]["receptor"];
    items: ComprobanteItemSnapshot[];
    qr: { url: string; dataUrl: string | null } | null;
    error: { codigo: string | null; mensaje: string } | null;
    creadoEn: string;
    emitidoEn: string | null;
};

const TIPO_FACTURA: Record<Exclude<ComprobanteTipo, "remito">, ComprobanteTipoDTO> = {
    factura_a: { codigo: CODIGO_AFIP_POR_TIPO.factura_a, letra: "A", nombre: "Factura A" },
    factura_b: { codigo: CODIGO_AFIP_POR_TIPO.factura_b, letra: "B", nombre: "Factura B" },
    factura_c: { codigo: CODIGO_AFIP_POR_TIPO.factura_c, letra: "C", nombre: "Factura C" },
    factura_m: { codigo: CODIGO_AFIP_POR_TIPO.factura_m, letra: "M", nombre: "Factura M" }
};

export const claseDe = (tipo: ComprobanteTipo): "factura" | "remito" =>
    tipo === "remito" ? "remito" : "factura";

export const tipoDe = (tipo: ComprobanteTipo): ComprobanteTipoDTO | null =>
    tipo === "remito" ? null : TIPO_FACTURA[tipo];

// El remito conserva la numeración histórica `0003/00001`; la factura usa el
// formato AFIP `00001-00000042`.
const numeroCompletoDe = (tipo: ComprobanteTipo, puntoVenta: number, numero: number | null): string | null => {
    if (numero === null) return null;

    if (tipo === "remito") {
        return `${String(puntoVenta).padStart(4, "0")}/${String(numero).padStart(5, "0")}`;
    }

    return `${String(puntoVenta).padStart(5, "0")}-${String(numero).padStart(8, "0")}`;
};

export function toComprobanteResumen(row: ComprobanteResumenRow): ComprobanteResumen {
    return {
        id: row.id,
        clase: claseDe(row.tipo),
        estado: row.estado,
        tipo: tipoDe(row.tipo),
        numero: row.numero,
        numeroCompleto: numeroCompletoDe(row.tipo, row.punto_venta, row.numero),
        fecha: row.fecha
    };
}

async function qrDataUrl(url: string | null): Promise<string | null> {
    if (url === null) return null;

    try {
        return await QRCode.toDataURL(url);
    } catch {
        // Un QR que no se puede generar no invalida el comprobante ya emitido.
        return null;
    }
}

export async function toComprobanteDTO({
    comprobante,
    factura
}: ComprobanteConFactura): Promise<ComprobanteDTO> {
    const resumen = toComprobanteResumen(comprobante);
    const qrUrl = factura?.qr_url ?? null;
    const emitida = comprobante.estado === "emitida";

    const qr = emitida && qrUrl !== null ? { url: qrUrl, dataUrl: await qrDataUrl(qrUrl) } : null;
    let error: ComprobanteDTO["error"] = null;
    if (comprobante.estado === "error") {
        error = {
            codigo: factura?.error_codigo ?? null,
            mensaje: factura?.error_mensaje ?? "No se pudo emitir el comprobante"
        };
    }

    return {
        ...resumen,
        plantillaVersion: comprobante.plantilla_version,
        puntoVenta: comprobante.punto_venta,
        cae: factura?.cae ?? null,
        caeVencimiento: factura?.cae_vencimiento ?? null,
        resultado: factura?.resultado ?? null,
        observaciones: factura?.observaciones ?? [],
        moneda: comprobante.moneda,
        importes: {
            subtotal: comprobante.importe_subtotal,
            envio: factura?.importe_envio ?? 0,
            descuento: factura?.importe_descuento ?? 0,
            neto: factura?.importe_neto ?? 0,
            iva: factura?.importe_iva ?? 0,
            exento: factura?.importe_exento ?? 0,
            noGravado: factura?.importe_no_gravado ?? 0,
            tributos: factura?.importe_tributos ?? 0,
            total: comprobante.importe_total
        },
        emisor: comprobante.emisor,
        receptor: comprobante.receptor,
        items: comprobante.items,
        qr,
        error,
        creadoEn: comprobante.creado_en.toISOString(),
        emitidoEn: factura?.emitido_en?.toISOString() ?? null
    };
}
