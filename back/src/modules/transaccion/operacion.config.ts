import { OperacionConfig, LibroOperacion, ComprobanteCtx } from "./operacion.types";
import { LibroService } from "../libro";
import { ClienteStockService } from "../cliente";
import { tipoCliente } from "../cliente";
import { TipoTransaccion, createTransaccion, tipoTransaccion } from "./transaccion.validator";
import { createVenta, createVentaConsignado } from "./venta.validator";
import { LibroCantidad } from "../libro/libro.validator";
import { AfipService } from "../../lib/afip/Afip";
import { ComprobanteService } from "../../lib/comprobantes/comprobante";
import { ValidationError } from "../../lib/http/errors";
import { Tx } from "../../db/client";
import { Client } from "../cliente/cliente.validator";

export type OperacionConfigDeps = {
    libroService: LibroService;
    clienteStockService: ClienteStockService;
    afipService: AfipService;
    comprobanteService: ComprobanteService;
};

// Factory en vez de objeto ya armado: recibe `libroService`/`clienteStockService`
// ya construidos (los arma `createTransaccionModule`, ver index.ts) en vez de
// importar el composition root (`container.ts`) — así el módulo transaccion no
// depende del container, que es justo lo que evita el ciclo container.ts ↔
// modules/transaccion al agregar este módulo al composition root.
export function createOperacionConfig({ libroService, clienteStockService, afipService, comprobanteService }: OperacionConfigDeps): Record<TipoTransaccion, OperacionConfig> {
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

    // Compartido por `ventaConsignacion`/`devolucion#resolverLibros`: arma el
    // `LibroOperacion` a partir de lo que ya se sabe del libro en el stock del
    // cliente (`info`), o del catálogo general si el cliente nunca lo tuvo.
    const buildLibroOperacion = async (
        item: LibroCantidad,
        userId: number,
        info: { id_libro: number; titulo: string } | undefined,
        precio: number,
        stock: number
    ): Promise<LibroOperacion> => {
        const resuelto = info ?? (await libroInfoFallback(item.isbn, userId));

        return {
            id_libro: resuelto.id_libro,
            isbn: item.isbn,
            titulo: resuelto.titulo,
            cantidad: item.cantidad,
            precio,
            stock
        };
    };

    // Compartido por `consignacion`/`ventaConsignacion`/`devolucion#moverStock`:
    // mueve el stock del libro en lo del cliente (no el general, ver
    // `librosTable.stock` en `venta`/`consignacion`).
    const moverStockCliente = (cliente: Client, libro: LibroOperacion, delta: number, tx: Tx): Promise<void> =>
        clienteStockService.moveStock(cliente.id, { id_libro: libro.id_libro, isbn: libro.isbn, precio: libro.precio }, delta, tx);

    // Compartido por `venta`/`ventaConsignacion` (mismo `if` que hoy en
    // `venta.controller.ts#vender`/`ventaConsignado`): factura sólo si el
    // cliente no es "negro".
    async function facturarSiCorresponde(ctx: ComprobanteCtx, filesFolder: string): Promise<void> {
        const { cliente, user, transaction, venta: ventaRow, libros } = ctx;

        if (cliente.tipo === tipoCliente.negro) return;
        if (ventaRow === null) throw new ValidationError("Falta la venta para facturar");

        const afip = afipService.getClient(user);
        const comprobanteData = await afipService.facturar(user.punto_venta!, ventaRow, cliente, afip);

        await comprobanteService.emitirComprobante({
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
                await moverStockCliente(cliente, libro, libro.cantidad, tx);
            }
        },
        generarComprobante: async (ctx) => {
            await comprobanteService.emitirComprobante({
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
                libros.map((item) => {
                    const hist = historicoPorIsbn.get(item.isbn);
                    const act = actualPorIsbn.get(item.isbn);

                    return buildLibroOperacion(item, userId, act ?? hist, hist?.precio ?? 0, act?.stock ?? 0);
                })
            );
        },
        // No toca `librosTable.stock` (spec: "no el stock general del libro").
        moverStock: async (libros, cliente, tx) => {
            for (const libro of libros) {
                await moverStockCliente(cliente, libro, -libro.cantidad, tx);
            }
        },
        generarComprobante: (ctx) => facturarSiCorresponde(ctx, "facturas")
    };

    const devolucion: OperacionConfig = {
        tipo: tipoTransaccion.devolucion,
        // Nunca genera archivo: el `file_path: ""` fijo se resuelve al insertar
        // la transacción en `operacion.service.ts`.
        filesFolder: "",
        esVenta: false,
        bodyParser: createTransaccion,
        clientValidation: (tipo) => tipo === tipoCliente.inscripto,
        resolverLibros: async (libros, cliente, userId) => {
            const stockActual = await clienteStockService.getStock(cliente.id, userId);
            const stockPorIsbn = new Map(stockActual.map((s) => [s.isbn, s]));

            return Promise.all(
                libros.map((item) => {
                    const stock = stockPorIsbn.get(item.isbn);

                    return buildLibroOperacion(item, userId, stock, stock?.precio ?? 0, stock?.stock ?? 0);
                })
            );
        },
        moverStock: async (libros, cliente, tx) => {
            for (const libro of libros) {
                await libroService.moveStock(libro.id_libro, libro.cantidad, tx);
                await moverStockCliente(cliente, libro, -libro.cantidad, tx);
            }
        },
        generarComprobante: null
    };

    return {
        [tipoTransaccion.venta]: venta,
        [tipoTransaccion.consignacion]: consignacion,
        [tipoTransaccion.ventaConsignacion]: ventaConsignacion,
        [tipoTransaccion.devolucion]: devolucion
    };
}
