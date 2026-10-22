import { api } from "./client";
import type { TipoCliente } from "./cliente";

export type TipoOperacion = "venta" | "consignacion" | "devolucion" | "ventaConsignacion";

// El medio de pago dejó de ser un valor fijo y pasó a ser un recurso de cada
// cuenta (ver specs/010-medios-pago). El tipo vive acá porque la venta lo
// expone en `Venta.medio_pago` y `getMediosPago` ya vivía en este módulo.
export type MedioPago = {
    id: number;
    nombre: string;
    comision: number;
};

// Refleja back/src/modules/transaccion/venta.validator.ts#tiposComprobantes:
// sólo "11" (Factura C) está habilitado hoy en la práctica (el resto exige
// datos de AFIP que la app vieja tampoco pedía), se mantiene igual acá.
export const tiposComprobante = [
    { value: 1, label: "Factura A", disabled: true },
    { value: 6, label: "Factura B", disabled: true },
    { value: 11, label: "Factura C", disabled: false },
    { value: 51, label: "Factura M", disabled: true }
] as const;
export type TipoCbte = (typeof tiposComprobante)[number]["value"];

export type LibroOperacion = {
    id_libro: number;
    isbn: string;
    titulo: string;
    cantidad: number;
    precio: number;
    stock: number;
};

// Campos comunes a las 4 operaciones (ver back operacion.service.ts). Un
// `file_path` vacío significa "no generó archivo" (siempre el caso en
// devolucion).
export type Operacion = {
    id: number;
    fecha: string;
    id_cliente: number;
    file_path: string;
    type: TipoOperacion;
    nombre_cliente: string;
    cuit: string | null;
    email: string | null;
    cond_fiscal: string | null;
    tipo_cliente: TipoCliente | null;
};

export type Venta = Operacion & {
    descuento: number;
    medio_pago: MedioPago;
    tipo_cbte: TipoCbte;
    total: number;
    // Derivado de la comisión congelada en la venta: `total − (comision/100)·total`.
    neto: number;
};

export type OperacionDetalle = Operacion & { libros: LibroOperacion[] };
export type VentaDetalle = Venta & { libros: LibroOperacion[] };

export type LibroCantidadInput = { isbn: string; cantidad: number };

export type CreateVentaInput = {
    cliente: number;
    libros: LibroCantidadInput[];
    descuento?: number;
    // Id del medio de pago de la cuenta (ya no el valor fijo de antes).
    medio_pago: number;
    tipo_cbte: TipoCbte;
};

export type CreateVentaConsignacionInput = CreateVentaInput & {
    // yyyy-mm-dd: precio histórico del stock consignado a esa fecha.
    fecha_venta: string;
};

export type CreateConsignacionInput = {
    cliente: number;
    libros: LibroCantidadInput[];
};

// `GET /venta/medios_pago` devuelve el mismo array pelado que `GET /medio_pago/`
// (sin sobre `{success,data}`, ver back/src/modules/medioPago/medioPago.controller.ts).
export const getMediosPago = (): Promise<MedioPago[]> => api.get("/venta/medios_pago");

// Las 4 rutas de operaciones (`/venta`, `/consignacion`, `/devolucion`,
// `/ventaConsignacion`) comparten forma: `listar`/`obtener` envuelven en
// `{success,data}` (NO en `{pagination,items}` — a diferencia de
// libro/persona/cliente, acá no hay paginación real, ver
// back/src/modules/transaccion/transaccion.controller.ts).
export const listVentas = (): Promise<{ success: true; data: Venta[] }> => api.get("/venta");
export const getVenta = (id: number): Promise<{ success: true; data: VentaDetalle }> => api.get(`/venta/${id}`);
export const createVenta = (input: CreateVentaInput): Promise<{ success: true; data: VentaDetalle }> => api.post("/venta", input);

export const createVentaConsignacion = (
    input: CreateVentaConsignacionInput
): Promise<{ success: true; data: VentaDetalle }> => api.post("/ventaConsignacion", input);

export const listConsignaciones = (): Promise<{ success: true; data: Operacion[] }> => api.get("/consignacion");
export const getConsignacion = (id: number): Promise<{ success: true; data: OperacionDetalle }> => api.get(`/consignacion/${id}`);
export const createConsignacion = (
    input: CreateConsignacionInput
): Promise<{ success: true; data: OperacionDetalle }> => api.post("/consignacion", input);

export const listDevoluciones = (): Promise<{ success: true; data: Operacion[] }> => api.get("/devolucion");
export const getDevolucion = (id: number): Promise<{ success: true; data: OperacionDetalle }> => api.get(`/devolucion/${id}`);
export const createDevolucion = (
    input: CreateConsignacionInput
): Promise<{ success: true; data: OperacionDetalle }> => api.post("/devolucion", input);
