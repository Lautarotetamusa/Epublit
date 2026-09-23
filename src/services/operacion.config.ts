import { OperacionConfig, LibroOperacion, ComprobanteCtx } from "./operacion.types";
import { libroService } from "./libro.service";
import { clienteStockService } from "./clienteStock.service";
import { tipoCliente } from "../validators/cliente.validator";
import { TipoTransaccion, createTransaccion, tipoTransaccion } from "../validators/transaccion.validator";
import { createVenta, createVentaConsignado } from "../validators/venta.validator";
import { LibroCantidad } from "../validators/libro.validator";
import { getAfipClient, facturar } from "../afip/Afip";
import { emitirComprobante } from "../comprobantes/comprobante";
import { ValidationError } from "../models/errors";

// Resuelve stock/precio *actuales* del libro (`librosTable`), compartido por
// `venta`/`consignacion` (ver plan, "Resolución de libros por tipo de
// operación"): ambas usan la misma fuente, sólo cambia qué hacen con el
// resultado en `moverStock`.
const resolverLibrosDeLibro = async (libros: LibroCantidad[], userId: number): Promise<LibroOperacion[]> => {
    return Promise.all(
        libros.map(async (item) => {
            const libro = await libroService.findOne(item.isbn, userId);
            return {
                id_libro: libro.id_libro,
                isbn: libro.isbn,
                titulo: libro.titulo,
                cantidad: item.cantidad,
                precio: libro.precio,
                stock: libro.stock ?? 0
            };
        })
    );
};

// Caso borde (ver plan): si el cliente nunca tuvo ese libro en consignación,
// `libro_cliente` no tiene fila para ese isbn. Se completa `id_libro`/`titulo`
// con el catálogo general para no perder el dato en la respuesta/mensaje de
// error, aunque el `stock`/`precio` del cliente queden en 0.
const libroInfoFallback = async (isbn: string, userId: number): Promise<{ id_libro: number; titulo: string }> => {
    const libro = await libroService.findOne(isbn, userId);
    return { id_libro: libro.id_libro, titulo: libro.titulo };
};

// venta

const venta: OperacionConfig = {
    tipo: tipoTransaccion.venta,
    filesFolder: "facturas",
    esVenta: true,
    bodyParser: createVenta,
    // `VentaFirme.clientValidation` (MySQL) no la sobreescribía: siempre true.
    clientValidation: () => true,
    resolverLibros: (libros, _cliente, userId) => resolverLibrosDeLibro(libros, userId),
    moverStock: async (libros, _cliente, tx) => {
        for (const libro of libros) {
            await libroService.moveStock(libro.id_libro, -libro.cantidad, tx);
        }
    },
    generarComprobante: (ctx) => facturarSiCorresponde(ctx, "facturas")
};

// consignacion

const consignacion: OperacionConfig = {
    tipo: tipoTransaccion.consignacion,
    filesFolder: "remitos",
    esVenta: false,
    bodyParser: createTransaccion,
    clientValidation: (tipo) => tipo === tipoCliente.inscripto,
    resolverLibros: (libros, _cliente, userId) => resolverLibrosDeLibro(libros, userId),
    moverStock: async (libros, cliente, tx) => {
        for (const libro of libros) {
            await libroService.moveStock(libro.id_libro, -libro.cantidad, tx);
            await clienteStockService.moveStock(
                cliente.id,
                { id_libro: libro.id_libro, isbn: libro.isbn, precio: libro.precio },
                libro.cantidad,
                tx
            );
        }
    },
    generarComprobante: async (ctx) => {
        await emitirComprobante({
            data: {
                consignacion: ctx.transaction,
                cliente: ctx.cliente,
                libros: ctx.libros,
                filesFolder: consignacion.filesFolder
            },
            user: ctx.user
        });
    }
};

// ventaConsignacion

const ventaConsignacion: OperacionConfig = {
    tipo: tipoTransaccion.ventaConsignacion,
    filesFolder: "facturas",
    esVenta: true,
    bodyParser: createVentaConsignado,
    clientValidation: (tipo) => tipo === tipoCliente.inscripto,
    resolverLibros: async (libros, cliente, userId, args) => {
        const [historico, actual] = await Promise.all([
            clienteStockService.getStock(cliente.id, userId, args?.fecha),
            clienteStockService.getStock(cliente.id, userId)
        ]);
        const historicoPorIsbn = new Map(historico.map((h) => [h.isbn, h]));
        const actualPorIsbn = new Map(actual.map((a) => [a.isbn, a]));

        return Promise.all(
            libros.map(async (item) => {
                const hist = historicoPorIsbn.get(item.isbn);
                const act = actualPorIsbn.get(item.isbn);
                const info = act ?? hist ?? (await libroInfoFallback(item.isbn, userId));

                return {
                    id_libro: info.id_libro,
                    isbn: item.isbn,
                    titulo: info.titulo,
                    cantidad: item.cantidad,
                    precio: hist?.precio ?? 0,
                    stock: act?.stock ?? 0
                };
            })
        );
    },
    // No toca `librosTable.stock` (spec: "no el stock general del libro").
    moverStock: async (libros, cliente, tx) => {
        for (const libro of libros) {
            await clienteStockService.moveStock(
                cliente.id,
                { id_libro: libro.id_libro, isbn: libro.isbn, precio: libro.precio },
                -libro.cantidad,
                tx
            );
        }
    },
    generarComprobante: (ctx) => facturarSiCorresponde(ctx, "facturas")
};

// devolucion

const devolucion: OperacionConfig = {
    tipo: tipoTransaccion.devolucion,
    // Nunca genera archivo: el `file_path: ""` fijo se resuelve al insertar
    // la transacción en el controller genérico (T19).
    filesFolder: "",
    esVenta: false,
    bodyParser: createTransaccion,
    clientValidation: (tipo) => tipo === tipoCliente.inscripto,
    resolverLibros: async (libros, cliente, userId) => {
        const stockActual = await clienteStockService.getStock(cliente.id, userId);
        const stockPorIsbn = new Map(stockActual.map((s) => [s.isbn, s]));

        return Promise.all(
            libros.map(async (item) => {
                const stock = stockPorIsbn.get(item.isbn);
                const info = stock ?? (await libroInfoFallback(item.isbn, userId));

                return {
                    id_libro: info.id_libro,
                    isbn: item.isbn,
                    titulo: info.titulo,
                    cantidad: item.cantidad,
                    precio: stock?.precio ?? 0,
                    stock: stock?.stock ?? 0
                };
            })
        );
    },
    moverStock: async (libros, cliente, tx) => {
        for (const libro of libros) {
            await libroService.moveStock(libro.id_libro, libro.cantidad, tx);
            await clienteStockService.moveStock(
                cliente.id,
                { id_libro: libro.id_libro, isbn: libro.isbn, precio: libro.precio },
                -libro.cantidad,
                tx
            );
        }
    },
    generarComprobante: null
};

// Compartido por `venta`/`ventaConsignacion` (mismo `if` que hoy en
// `venta.controller.ts#vender`/`ventaConsignado`): factura sólo si el
// cliente no es "negro".
async function facturarSiCorresponde(ctx: ComprobanteCtx, filesFolder: string): Promise<void> {
    const { cliente, user, transaction, venta: ventaRow, libros } = ctx;

    if (cliente.tipo === tipoCliente.negro) return;
    if (ventaRow === null) throw new ValidationError("Falta la venta para facturar");

    const afip = getAfipClient(user).ElectronicBilling;
    if (afip === undefined) {
        throw new ValidationError("No se puede obtener el cliente de afip");
    }

    const comprobanteData = await facturar(user.punto_venta!, ventaRow, cliente, afip);

    await emitirComprobante({
        data: {
            venta: ventaRow,
            transaction,
            libros,
            cliente,
            comprobante: comprobanteData,
            filesFolder
        },
        user
    });
}

export const operacionConfig: Record<TipoTransaccion, OperacionConfig> = {
    [tipoTransaccion.venta]: venta,
    [tipoTransaccion.consignacion]: consignacion,
    [tipoTransaccion.ventaConsignacion]: ventaConsignacion,
    [tipoTransaccion.devolucion]: devolucion
};
