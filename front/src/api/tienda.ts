import { api, toQueryString } from "./client";
import type { BlobFile } from "./client";
import type { ComprobanteResumen } from "./comprobantes";

// Contratos reales del panel de la tienda (ver back/src/modules/tienda).
// Las rutas de pedidos NO usan el sobre `{success,data}`: devuelven el
// recurso o el listado directo. Las de configuración sí lo usan.
export type Envelope<T> = {
    success: true;
    message?: string;
    data: T;
};

export type EstadoPedido =
    | "pendiente_pago"
    | "pagado"
    | "aceptado"
    | "rechazado"
    | "enviado"
    | "entregado"
    | "cancelado";

export type EstadoPago = "pendiente" | "aprobado" | "rechazado" | "reembolsado";
export type FormaEntrega = "envio" | "retiro";

export type ConteosPedidos = Record<EstadoPedido, number> & { todos: number };

export type CompradorResumen = {
    nombre: string;
    email: string;
    telefono: string | null;
};

export type PedidoResumen = {
    codigo: string;
    fecha: string;
    comprador: CompradorResumen;
    total: number;
    estadoPago: EstadoPago;
    entrega: FormaEntrega;
    estado: EstadoPedido;
    cantidadItems: number;
};

export type ListPedidosParams = {
    estado?: EstadoPedido | "todos";
    buscar?: string;
    desde?: string;
    hasta?: string;
    entrega?: FormaEntrega;
    pagina?: number;
    porPagina?: number;
};

export type ListPedidosResponse = {
    pedidos: PedidoResumen[];
    total: number;
    pagina: number;
    porPagina: number;
    conteos: ConteosPedidos;
};

type QueryParams = Record<string, string | number | boolean | undefined>;

// Los filtros vacíos no viajan: el backend es estricto con `desde`/`hasta`
// y un `buscar=` vacío sólo agrega ruido a la URL.
function sinVacios(params: QueryParams): QueryParams {
    return Object.fromEntries(
        Object.entries(params).filter(([, value]) => value !== undefined && value !== "")
    );
}

export const listPedidos = (params: ListPedidosParams = {}): Promise<ListPedidosResponse> =>
    api.get(`/pedidos${toQueryString(sinVacios(params))}`);

export type DireccionPedido = {
    calle: string | null;
    numero: string | null;
    piso: string | null;
    depto: string | null;
    localidad: string | null;
    provincia: string | null;
    codigoPostal: string | null;
};

export type EntregaPedido =
    | {
          tipo: "envio";
          direccion: DireccionPedido;
          costoEnvio: number;
      }
    | {
          tipo: "retiro";
          punto: string | null;
          horario: string | null;
      };

export type ItemPedido = {
    isbn: string;
    titulo: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
};

export type PagoPedido = {
    proveedor: string;
    estado: EstadoPago;
    idOperacion: string | null;
    importe: number;
    moneda: string;
    fecha: string | null;
};

export type VentaPedido = {
    id: number;
    total: number;
    tipoCbte: number;
    medioPagoId: number | null;
};

export type EventoSeguimiento = {
    estado: string | null;
    statusId: string | null;
    facility: string | null;
    sign: string | null;
    descripcion: string | null;
    fecha: string | null;
};

export type EnvioPedido = {
    proveedor: "PAQ.AR";
    numeroEnvio: string | null;
    codigoSeguimiento: string | null;
    estado: string | null;
    ultimaActualizacion: string | null;
    url: string | null;
    etiqueta: {
        disponible: boolean;
        creadaEl: string | null;
        url: string | null;
    };
    despachadoEn: string | null;
    eventos: EventoSeguimiento[];
    error: string | null;
};

export type HistorialPedido = {
    tipo: string;
    descripcion: string;
    fecha: string;
};

export type CajaPedido = {
    altoCm: number | null;
    anchoCm: number | null;
    largoCm: number | null;
};

export type CompradorPedido = CompradorResumen & {
    documento: string | null;
};

export type PedidoDetalle = {
    codigo: string;
    fecha: string;
    actualizadoEn: string;
    estado: EstadoPedido;
    estadoPago: EstadoPago;
    comprador: CompradorPedido;
    entrega: EntregaPedido;
    items: ItemPedido[];
    subtotal: number;
    costoEnvio: number;
    total: number;
    pesoKg: number | null;
    caja: CajaPedido | null;
    pago: PagoPedido;
    envio: EnvioPedido | null;
    venta: VentaPedido | null;
    comprobante: ComprobanteResumen | null;
    motivoRechazo: string | null;
    detalleRechazo: string | null;
    historial: HistorialPedido[];
};

export const getPedido = (codigo: string): Promise<PedidoDetalle> => api.get(`/pedidos/${codigo}`);

export const aceptarPedido = (codigo: string): Promise<PedidoDetalle> =>
    api.post(`/pedidos/${codigo}/aceptar`);

export const facturarPedido = (codigo: string): Promise<PedidoDetalle> =>
    api.post(`/pedidos/${codigo}/facturar`);

export type RechazarPedidoInput = {
    motivo: string;
    detalle?: string;
};

export const rechazarPedido = (codigo: string, input: RechazarPedidoInput): Promise<PedidoDetalle> =>
    api.post(`/pedidos/${codigo}/rechazar`, input);

export type GenerarEtiquetaInput = {
    direccion?: Partial<{
        calle: string;
        numero: string;
        piso: string;
        depto: string;
        localidad: string;
        provincia: string;
        codigoPostal: string;
    }>;
};

export const generarEtiqueta = (codigo: string, input: GenerarEtiquetaInput = {}): Promise<{ envio: unknown }> =>
    api.post(`/pedidos/${codigo}/etiqueta`, input);

export const enviarPedido = (codigo: string): Promise<PedidoDetalle> =>
    api.post(`/pedidos/${codigo}/enviar`);

export const entregarPedido = (codigo: string): Promise<PedidoDetalle> =>
    api.post(`/pedidos/${codigo}/entregar`);

export const getEnvioPedido = (codigo: string): Promise<EnvioPedido> =>
    api.get(`/pedidos/${codigo}/envio`);

export const refrescarEnvioPedido = (codigo: string): Promise<EnvioPedido> =>
    api.post(`/pedidos/${codigo}/envio/refrescar`);

// La etiqueta sigue siendo un PDF protegido: baja con el token en el header y
// la UI la descarga con `lib/descargas.ts`. El comprobante ya no se pide como
// archivo: se renderiza desde `GET /comprobantes/:id`.
export const descargarEtiqueta = (codigo: string): Promise<BlobFile> =>
    api.getBlob(`/pedidos/${codigo}/etiqueta`);

// ---- Integraciones ---------------------------------------------------------

export type Integracion = {
    id: number;
    nombre: string;
    prefijo: string;
    origen: string;
    activa: boolean;
    revocada: boolean;
    ultimoUso: string | null;
    creadaEn: string;
};

export const listIntegraciones = (): Promise<Envelope<{ integraciones: Integracion[] }>> =>
    api.get("/integraciones");

export type CreateIntegracionInput = {
    nombre: string;
    origen: string;
};

export const createIntegracion = (
    input: CreateIntegracionInput
): Promise<Envelope<{ integracion: Integracion; apiKey: string }>> =>
    api.post("/integraciones", input);

export const updateIntegracion = (id: number, input: { activa: boolean }): Promise<Envelope<Integracion>> =>
    api.patch(`/integraciones/${id}`, input);

export const revocarIntegracion = (id: number): Promise<Envelope<Integracion>> =>
    api.del(`/integraciones/${id}`);

// ---- MercadoPago -----------------------------------------------------------

export type MercadoPagoStatus = {
    conectado: boolean;
    alias?: string | null;
    email?: string | null;
    aplicacionId?: string | null;
    conectadoEl?: string;
};

export const getMercadoPago = (): Promise<Envelope<MercadoPagoStatus>> =>
    api.get("/tienda/mercadopago");

export const getMercadoPagoConnectUrl = (): Promise<Envelope<{ url: string }>> =>
    api.get("/tienda/mercadopago/conectar");

export const desconectarMercadoPago = (): Promise<Envelope<{ conectado: false }>> =>
    api.del("/tienda/mercadopago");

// ---- Envíos y retiro -------------------------------------------------------

export type ShippingOrigin = {
    calle: string | null;
    numero: string | null;
    piso: string | null;
    depto: string | null;
    localidad: string | null;
    provincia: string | null;
    codigoPostal: string | null;
};

export type ShippingConfig = {
    micorreo: { usuario: string | null; customerId: string | null; configurado: boolean };
    paqar: { agreement: string | null; sellerId: string | null; configurado: boolean };
    origen: ShippingOrigin;
    cajaDefault: { altoCm: number; anchoCm: number; largoCm: number };
    pesoPromedioKg: number | null;
    formatoEtiqueta: string;
    retiro: { activo: boolean; direccion: string | null; horario: string | null };
};

export type ShippingConfigUpdate = {
    micorreo?: { usuario?: string; password?: string; customerId?: string };
    paqar?: { agreement?: string; apiKey?: string; sellerId?: string };
    origen?: {
        calle: string;
        numero: string;
        piso?: string | null;
        depto?: string | null;
        localidad: string;
        provincia: string;
        codigoPostal: string;
    };
    cajaDefault?: { altoCm: number; anchoCm: number; largoCm: number };
    pesoPromedioKg?: number | null;
    formatoEtiqueta?: "10x15";
    retiro?: { activo: boolean; direccion?: string | null; horario?: string | null };
};

export type TestConnectionResult = {
    api: "micorreo" | "paqar";
    ok: boolean;
    mensaje: string;
};

export const getShippingConfig = (): Promise<Envelope<ShippingConfig>> =>
    api.get("/tienda/envios");

export const updateShippingConfig = (input: ShippingConfigUpdate): Promise<Envelope<ShippingConfig>> =>
    api.put("/tienda/envios", input);

// 422 es un resultado de negocio (`ok:false` + `mensaje`), no un error de
// red: se deja pasar para que la pantalla muestre el motivo.
export const testShippingConnection = (apiName: "micorreo" | "paqar"): Promise<TestConnectionResult> =>
    api.post("/tienda/envios/probar", { api: apiName }, { allowedStatuses: [422] });
