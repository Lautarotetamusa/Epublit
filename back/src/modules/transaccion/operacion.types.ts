import { ZodSchema } from "zod";
import { Tx } from "../../db/client";
import { TipoTransaccion, CreateTransaccion } from "./transaccion.validator";
import { VentaRow, CreateVentaConsignado } from "./venta.validator";
import { Client, TipoCliente } from "../cliente/cliente.validator";
import { LibroCantidad } from "../libro/libro.validator";
import { User } from "../user/user.validator";
import { MedioPago } from "../medioPago";
import type { ComprobanteRow } from "../comprobante";

// Superficie común de los cuatro `bodyParser` (`createTransaccion`/
// `createVenta`/`createVentaConsignado`), que el controller genérico
// (`crearOperacion`) necesita leer sin conocer cuál de los tres parseó el
// body: los campos de venta/`fecha_venta` quedan opcionales porque
// `consignacion`/`devolucion` no los tienen.
export type OperacionBody = CreateTransaccion & Partial<CreateVentaConsignado>;

// Shape compartido devuelto por `resolverLibros` de las cuatro operaciones y
// por `movimientoRepository.getLibrosDe`.
export type LibroOperacion = {
    id_libro: number;
    isbn: string;
    titulo: string;
    cantidad: number;
    precio: number;
    stock: number;
};

// Extremo del movimiento comercial, antes de persistirlo.
export type ExtremoOperacion =
    | { tipo: "deposito"; id: number }
    | { tipo: "exterior" };

// `venta` es `null` para `consignacion`/`devolucion`, que no crean extensión de
// venta. `user` es el emisor fiscal y `medioPago` (resuelto antes de abrir la
// transacción) alimenta la condición de venta del snapshot.
export type ComprobanteCtx = {
    transaction: MovimientoComprobante;
    venta: VentaRow | null;
    medioPago: MedioPago | null;
    libros: LibroOperacion[];
    cliente: Client;
    user: User;
};

// Lo único que el emisor de comprobantes necesita del movimiento: su id y su
// fecha (el remito conserva la fecha del movimiento).
export type MovimientoComprobante = {
    id: number;
    fecha: Date;
};

// Reemplaza la jerarquía `Transaccion`/`Venta`/`VentaFirme`/`VentaConsignado`/
// `Consignacion`/`Devolucion` (herencia) por composición: cada tipo de
// operación es una instancia de este objeto, no una subclase (ver plan,
// "Enfoque técnico" — CLAUDE.md, "Inyección de dependencias > herencia").
export type OperacionConfig = {
    tipo: TipoTransaccion;
    esVenta: boolean;
    bodyParser: ZodSchema;
    clientValidation: (tipo: TipoCliente) => boolean;
    resolverLibros: (
        libros: LibroCantidad[],
        cliente: Client,
        userId: number,
        args?: { fecha?: Date; depositoId?: number }
    ) => Promise<LibroOperacion[]>;
    // Extremos del movimiento según el tipo (principal/depósito del cliente).
    // `depositoId` llega por args en `venta` para elegir el depósito de origen.
    obtenerExtremos: (
        cliente: Client,
        userId: number,
        args?: { depositoId?: number }
    ) => Promise<{ origen: ExtremoOperacion; destino: ExtremoOperacion }>;
    // Congela el precio por libro (sólo consignación).
    fijarPrecios?: (libros: LibroOperacion[], cliente: Client, tx: Tx) => Promise<void>;
    // Crea la fila de comprobante dentro de la transacción de la operación
    // (factura pendiente o remito ya emitido). La emisión AFIP ocurre después
    // del commit, en `operacion.service.ts`.
    generarComprobante: ((ctx: ComprobanteCtx, tx: Tx) => Promise<ComprobanteRow | null>) | null;
};
