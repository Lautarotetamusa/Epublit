import type { ShipmentEventRow, ShipmentRow } from "./shipment.repository";

export const TRACKING_FALLBACK_URL =
    "https://www.correoargentino.com.ar/formularios/e-commerce";

export type ShippingBlock = {
    proveedor: "PAQ.AR";
    numeroEnvio: string | null;
    codigoSeguimiento: string | null;
    estado: string | null;
    ultimaActualizacion: Date | null;
    url: string | null;
    etiqueta: {
        disponible: boolean;
        creadaEl: Date | null;
        url: string | null;
    };
    despachadoEn: Date | null;
    eventos: {
        estado: string | null;
        statusId: string | null;
        facility: string | null;
        sign: string | null;
        descripcion: string | null;
        fecha: Date | null;
    }[];
    error: string | null;
};

const labelUrl = (codigo: string, shipment: ShipmentRow | null): string | null =>
    shipment?.etiqueta_file_path ? `/pedidos/${codigo}/etiqueta` : null;

export function toShippingBlock(
    codigo: string,
    shipment: ShipmentRow | null,
    events: ShipmentEventRow[],
    error: string | null = null
): ShippingBlock {
    const tieneCodigo = Boolean(shipment?.codigo_seguimiento);

    return {
        proveedor: "PAQ.AR",
        numeroEnvio: shipment?.proveedor_envio_id ?? null,
        codigoSeguimiento: shipment?.codigo_seguimiento ?? null,
        estado: shipment?.estado ?? null,
        ultimaActualizacion: shipment?.ultima_actualizacion ?? null,
        url: tieneCodigo
            ? shipment?.url_seguimiento ?? TRACKING_FALLBACK_URL
            : null,
        etiqueta: {
            disponible: Boolean(shipment?.etiqueta_file_path),
            creadaEl: shipment?.etiqueta_creada_en ?? null,
            url: labelUrl(codigo, shipment)
        },
        despachadoEn: shipment?.despachado_en ?? null,
        eventos: events.map((event) => ({
            estado: event.estado,
            statusId: event.status_id,
            facility: event.facility,
            sign: event.sign,
            descripcion: event.descripcion,
            fecha: event.fecha_evento
        })),
        error
    };
}

export function toLabelResponse(codigo: string, shipment: ShipmentRow) {
    return {
        envio: {
            proveedorEnvioId: shipment.proveedor_envio_id,
            codigoSeguimiento: shipment.codigo_seguimiento,
            etiquetaDisponible: Boolean(shipment.etiqueta_file_path),
            etiquetaUrl: labelUrl(codigo, shipment),
            etiquetaCreadaEl: shipment.etiqueta_creada_en
        }
    };
}
