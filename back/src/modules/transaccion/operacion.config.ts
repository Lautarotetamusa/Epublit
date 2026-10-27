import { OperacionConfig, LibroOperacion, ComprobanteCtx, ExtremoOperacion } from "./operacion.types";
import { LibroService } from "../libro";
import { ClienteStockService } from "../cliente";
import { tipoCliente } from "../cliente";
import { DepositoRepository } from "../deposito";
import { TipoTransaccion, createTransaccion, tipoTransaccion } from "./transaccion.validator";
import { createVenta, createVentaConsignado } from "./venta.validator";
import { LibroCantidad } from "../libro/libro.validator";
import { disponibleParaVenta } from "../libro/libro.stock";
import { AfipService } from "../../lib/afip/Afip";
import { ComprobanteService } from "../../lib/comprobantes/comprobante";
import { ValidationError } from "../../lib/http/errors";
import { Tx } from "../../db/client";
import { Client } from "../cliente/cliente.validator";

export type OperacionConfigDeps = {
    libroService: LibroService;
    clienteStockService: ClienteStockService;
    // Depósito principal y depósito propio del cliente: los extremos y el
    // efecto de stock de las cuatro operaciones (ver specs/009-ledger-unificado).
    depositoRepository: Pick<DepositoRepository, "findPrincipal" | "findClienteDeposito">;
    afipService: AfipService;
    comprobanteService: ComprobanteService;
};

// Factory en vez de objeto ya armado: recibe `libroService`/`clienteStockService`
// ya construidos (los arma `createTransaccionModule`, ver index.ts) en vez de
// importar el composition root (`container.ts`) — así el módulo transaccion no
// depende del container.
export function createOperacionConfig({ libroService, clienteStockService, depositoRepository, afipService, comprobanteService }: OperacionConfigDeps): Record<TipoTransaccion, OperacionConfig> {
    const principal = async (userId: number): Promise<ExtremoOperacion> => ({
        tipo: "deposito",
        id: (await depositoRepository.findPrincipal(userId)).id
    });

    const depositoDelCliente = async (cliente: Client, userId: number): Promise<ExtremoOperacion> => ({
        tipo: "deposito",
        id: (await depositoRepository.findClienteDeposito(cliente.id, userId)).id
    });

    // Resuelve stock/precio *actuales* del libro (`librosTable`), compartido por
    // `venta`/`consignacion`: el stock disponible es el del depósito principal
    // menos las reservas activas (ver specs/008-movimientos-deposito y
    // specs/016-tienda-ecommerce). La venta suma el límite negativo permitido;
    // la consignación sigue exigiendo stock físico.
    const resolverLibrosDeLibro = async (
        libros: LibroCantidad[],
        userId: number,
        aplicarLimiteNegativo = false
    ): Promise<LibroOperacion[]> => {
        return Promise.all(
            libros.map(async (item) => {
                const libro = await libroService.findOne(item.isbn, userId);
                return {
                    id_libro: libro.id_libro,
                    isbn: libro.isbn,
                    titulo: libro.titulo,
                    cantidad: item.cantidad,
                    precio: libro.precio,
                    stock: aplicarLimiteNegativo
                        ? disponibleParaVenta(libro.disponible_principal, libro.stock_negativo_permitido)
                        : Math.max(0, libro.disponible_principal)
                };
            })
        );
    };

    // Caso borde: si el cliente nunca tuvo ese libro en consignación, no hay
    // info en su depósito para ese isbn. Se completa `id_libro`/`titulo` con el
    // catálogo general para no perder el dato en la respuesta/mensaje de error,
    // aunque el `stock`/`precio` del cliente queden en 0.
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

    // Compartido por `venta`/`ventaConsignacion` (mismo `if` que hoy): factura
    // sólo si el cliente no es "negro".
    async function facturarSiCorresponde(ctx: ComprobanteCtx): Promise<void> {
        const { cliente, user, transaction, venta: ventaRow, medioPago, libros } = ctx;

        if (cliente.tipo === tipoCliente.negro) return;
        if (ventaRow === null) throw new ValidationError("Falta la venta para facturar");

        const afip = afipService.getClient(user);
        const comprobanteData = await afipService.facturar(user.punto_venta!, ventaRow, cliente, afip);

        await comprobanteService.emitirComprobante({
            data: {
                venta: ventaRow,
                medioPago,
                transaction,
                libros,
                cliente,
                comprobante: comprobanteData
            },
            user
        });
    }

    // Compartido por `consignacion`/`devolucion`: ambas adjuntan un remito al
    // movimiento (la devolución no tiene plantilla propia).
    const emitirRemito = async (ctx: ComprobanteCtx): Promise<void> => {
        await comprobanteService.emitirComprobante({
            data: {
                consignacion: ctx.transaction,
                cliente: ctx.cliente,
                libros: ctx.libros
            },
            user: ctx.user
        });
    };

    const venta: OperacionConfig = {        tipo: tipoTransaccion.venta,
        filesFolder: "facturas",
        esVenta: true,
        bodyParser: createVenta,
        // `VentaFirme.clientValidation` (MySQL) no la sobreescribía: siempre true.
        clientValidation: () => true,
        resolverLibros: (libros, _cliente, userId) => resolverLibrosDeLibro(libros, userId, true),
        obtenerExtremos: async (_cliente, userId) => ({
            origen: await principal(userId),
            destino: { tipo: "exterior" }
        }),
        generarComprobante: facturarSiCorresponde
    };

    const consignacion: OperacionConfig = {
        tipo: tipoTransaccion.consignacion,
        filesFolder: "remitos",
        esVenta: false,
        bodyParser: createTransaccion,
        clientValidation: (tipo) => tipo === tipoCliente.inscripto,
        resolverLibros: (libros, _cliente, userId) => resolverLibrosDeLibro(libros, userId),
        obtenerExtremos: async (cliente, userId) => ({
            origen: await principal(userId),
            destino: await depositoDelCliente(cliente, userId)
        }),
        fijarPrecios: async (libros, cliente, tx: Tx) => {
            for (const libro of libros) {
                await clienteStockService.setPrecio(cliente.id, libro, tx);
            }
        },
        generarComprobante: emitirRemito
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
        obtenerExtremos: async (cliente, userId) => ({
            origen: await depositoDelCliente(cliente, userId),
            destino: { tipo: "exterior" }
        }),
        generarComprobante: facturarSiCorresponde
    };

    const devolucion: OperacionConfig = {
        tipo: tipoTransaccion.devolucion,
        // El comprobante de la devolución se emite con la plantilla de remito:
        // no hay un archivo propio de devolución (ver plan, "Archivo opcional").
        filesFolder: "remitos",
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
        obtenerExtremos: async (cliente, userId) => ({
            origen: await depositoDelCliente(cliente, userId),
            destino: await principal(userId)
        }),
        generarComprobante: emitirRemito
    };

    return {
        [tipoTransaccion.venta]: venta,
        [tipoTransaccion.consignacion]: consignacion,
        [tipoTransaccion.ventaConsignacion]: ventaConsignacion,
        [tipoTransaccion.devolucion]: devolucion
    };
}
