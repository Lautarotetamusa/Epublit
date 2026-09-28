import { ZodSchema } from "zod";
import { Tx } from "../../db/client";
import { TipoTransaccion, TransaccionRow, CreateTransaccion } from "./transaccion.validator";
import { VentaRow, CreateVentaConsignado } from "./venta.validator";
import { Client, TipoCliente } from "../cliente/cliente.validator";
import { LibroCantidad } from "../libro/libro.validator";
import { User } from "../user/user.validator";

// Superficie común de los cuatro `bodyParser` (`createTransaccion`/
// `createVenta`/`createVentaConsignado`), que el controller genérico
// (`crearOperacion`) necesita leer sin conocer cuál de los tres parseó el
// body: los campos de venta/`fecha_venta` quedan opcionales porque
// `consignacion`/`devolucion` no los tienen.
export type OperacionBody = CreateTransaccion & Partial<CreateVentaConsignado>;

// Shape compartido devuelto por `resolverLibros` de las cuatro operaciones y
// por `transaccionService.getLibros`.
export type LibroOperacion = {
    id_libro: number;
    isbn: string;
    titulo: string;
    cantidad: number;
    precio: number;
    stock: number;
};

// Resultado del JOIN `transacciones`+`clientes` que hace
// `transaccionService.getAll`/`getById`.
export type TransaccionConCliente = TransaccionRow & {
    nombre_cliente: string;
    cuit: string | null;
    email: string | null;
    cond_fiscal: string | null;
    tipo_cliente: TipoCliente | null;
};

// `venta` es `null` para `consignacion`/`devolucion`, que no insertan en
// `ventasTable`. Se pasa `user` completo (no sólo `userId`) porque
// `generarComprobante` de `venta`/`ventaConsignacion` necesita
// `getAfipClient(user)`/`facturar(...)` (cuit, punto_venta, etc.), y
// `emitirComprobante` necesita razon_social/domicilio/cond_fiscal/etc.
export type ComprobanteCtx = {
    transaction: TransaccionConCliente;
    venta: VentaRow | null;
    libros: LibroOperacion[];
    cliente: Client;
    user: User;
};

// Reemplaza la jerarquía `Transaccion`/`Venta`/`VentaFirme`/`VentaConsignado`/
// `Consignacion`/`Devolucion` (herencia) por composición: cada tipo de
// operación es una instancia de este objeto, no una subclase (ver plan,
// "Enfoque técnico" — CLAUDE.md, "Inyección de dependencias > herencia").
export type OperacionConfig = {
    tipo: TipoTransaccion;
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
    moverStock: (libros: LibroOperacion[], cliente: Client, tx: Tx) => Promise<void>;
    generarComprobante: ((ctx: ComprobanteCtx, tx: Tx) => Promise<void>) | null;
};
