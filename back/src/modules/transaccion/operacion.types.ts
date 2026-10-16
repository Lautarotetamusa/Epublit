import { ZodSchema } from "zod";
import { Tx } from "../../db/client";
import { TipoTransaccion, CreateTransaccion } from "./transaccion.validator";
import { VentaRow, CreateVentaConsignado } from "./venta.validator";
import { Client, TipoCliente } from "../cliente/cliente.validator";
import { LibroCantidad } from "../libro/libro.validator";
import { User } from "../user/user.validator";
import { MedioPago } from "../medioPago";

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
// venta. Se pasa `user` completo (no sólo `userId`) porque `generarComprobante`
// de `venta`/`ventaConsignacion` necesita `getAfipClient(user)`/`facturar(...)`.
// `medioPago` (resuelto antes de abrir la transacción) lo consume el
// comprobante para mostrar el nombre del medio.
export type ComprobanteCtx = {
    transaction: MovimientoComprobante;
    venta: VentaRow | null;
    medioPago: MedioPago | null;
    libros: LibroOperacion[];
    cliente: Client;
    user: User;
};

// Lo único que el emisor de comprobantes necesita del movimiento: su id (para
// numerar el remito) y la key de storage del archivo.
export type MovimientoComprobante = {
    id: number;
    file_path: string;
};

// Reemplaza la jerarquía `Transaccion`/`Venta`/`VentaFirme`/`VentaConsignado`/
// `Consignacion`/`Devolucion` (herencia) por composición: cada tipo de
// operación es una instancia de este objeto, no una subclase (ver plan,
// "Enfoque técnico" — CLAUDE.md, "Inyección de dependencias > herencia").
export type OperacionConfig = {
    tipo: TipoTransaccion;
    // Carpeta de storage del archivo emitido (facturas/remitos).
    filesFolder: string;
    esVenta: boolean;
    bodyParser: ZodSchema;
    clientValidation: (tipo: TipoCliente) => boolean;
    resolverLibros: (
        libros: LibroCantidad[],
        cliente: Client,
        userId: number,
        args?: { fecha?: Date }
    ) => Promise<LibroOperacion[]>;
    // Extremos del movimiento según el tipo (principal/depósito del cliente).
    obtenerExtremos: (cliente: Client, userId: number) => Promise<{ origen: ExtremoOperacion; destino: ExtremoOperacion }>;
    // Congela el precio por libro (sólo consignación).
    fijarPrecios?: (libros: LibroOperacion[], cliente: Client, tx: Tx) => Promise<void>;
    generarComprobante: ((ctx: ComprobanteCtx, tx: Tx) => Promise<void>) | null;
};
