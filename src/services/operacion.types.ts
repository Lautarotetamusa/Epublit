import { ZodSchema } from "zod";
import { db } from "../pgDb";
import { TipoTransaccion, TransaccionRow, CreateTransaccion } from "../validators/transaccion.validator";
import { VentaRow, CreateVentaConsignado } from "../validators/venta.validator";
import { Client, TipoCliente } from "../validators/cliente.validator";
import { LibroCantidad } from "../validators/libro.validator";
import { User } from "../validators/user.validator";

// Superficie común de los cuatro `bodyParser` (`createTransaccion`/
// `createVenta`/`createVentaConsignado`), que el controller genérico
// (`crearOperacion`) necesita leer sin conocer cuál de los tres parseó el
// body: los campos de venta/`fecha_venta` quedan opcionales porque
// `consignacion`/`devolucion` no los tienen.
export type OperacionBody = CreateTransaccion & Partial<CreateVentaConsignado>;

// Tipo de la transacción de Drizzle que recibe `db.transaction(async (tx) => ...)`,
// inferido de la propia firma de `db` para no duplicarlo a mano ni depender
// de un tipo interno de bradb.
export type Tx = Parameters<typeof db.transaction>[0] extends (tx: infer T, ...args: unknown[]) => unknown ? T : never;

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
// `emitirComprobante` necesita razon_social/domicilio/cond_fiscal/etc. — ver
// plan/tasks T14, que deja la forma exacta a esta decisión de implementación.
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
