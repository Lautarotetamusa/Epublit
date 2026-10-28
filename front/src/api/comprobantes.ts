import { api } from "./client";

// Contrato real de `GET /comprobantes/:id` y `POST /comprobantes/:id/reintentar`
// (ver back/src/modules/comprobante/comprobante.serializer.ts). El resumen es
// lo que traen las fichas como `comprobante`; el DTO completo sólo se pide
// para renderizar el documento.

export type ComprobanteClase = "factura" | "remito";
export type ComprobanteEstado = "pendiente" | "emitida" | "error";
export type FacturaResultado = "A" | "R";

export type ComprobanteTipo = {
    codigo: number;
    letra: string;
    nombre: string;
};

export type ComprobanteResumen = {
    id: number;
    clase: ComprobanteClase;
    estado: ComprobanteEstado;
    tipo: ComprobanteTipo | null;
    numero: number | null;
    numeroCompleto: string | null;
    fecha: string | null;
};

export type ComprobanteImportes = {
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

export type ComprobanteEmisor = {
    razonSocial: string;
    cuit: string;
    condicionFiscal: string;
    domicilio: string;
    ingresosBrutos: string | null;
    inicioActividades: string;
    email: string | null;
    logoUrl: string | null;
};

export type ComprobanteReceptor = {
    razonSocial: string;
    cuit: string | null;
    documento: string | null;
    condicionFiscal: string;
    domicilio: string;
    condicionVenta: string | null;
};

export type ComprobanteItem = {
    isbn: string | null;
    titulo: string;
    autor: string | null;
    cantidad: number;
    precioUnitario: number;
    descuentoPorcentaje: number;
    importeDescuento: number;
    subtotal: number;
};

export type ComprobanteQR = {
    url: string;
    // El backend genera el PNG y lo manda embebido: el front no agrega una
    // dependencia de QR ni pide otra imagen.
    dataUrl: string | null;
};

export type ComprobanteDTO = ComprobanteResumen & {
    plantillaVersion: number;
    puntoVenta: number;
    cae: string | null;
    caeVencimiento: string | null;
    resultado: FacturaResultado | null;
    observaciones: unknown[];
    moneda: string;
    importes: ComprobanteImportes;
    emisor: ComprobanteEmisor;
    receptor: ComprobanteReceptor;
    items: ComprobanteItem[];
    qr: ComprobanteQR | null;
    error: { codigo: string | null; mensaje: string } | null;
    creadoEn: string;
    emitidoEn: string | null;
};

export const getComprobante = (id: number): Promise<{ success: true; data: ComprobanteDTO }> =>
    api.get(`/comprobantes/${id}`);

export const reintentarComprobante = (id: number): Promise<{ success: true; data: ComprobanteDTO }> =>
    api.post(`/comprobantes/${id}/reintentar`);
