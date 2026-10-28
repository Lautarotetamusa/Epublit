import { Database } from "../../db/client";
import { StockInsuficiente, ValidationError } from "../../lib/http/errors";
import { calcularNeto } from "../../lib/venta";
import { UserRepository } from "../user";
import { ClienteRepository } from "../cliente";
import { DepositoRepository } from "../deposito";
import { MedioPagoService } from "../medioPago";
import { MovimientoConDetalle, MovimientoRepository } from "../movimiento";
import type { ComprobanteResumen, ComprobanteRow, ComprobanteService } from "../comprobante";
import { VentaRepository } from "./venta.repository";
import { ListVentasFilter } from "./venta.validator";
import { TipoTransaccion } from "./transaccion.validator";
import { OperacionConfig, LibroOperacion, OperacionBody } from "./operacion.types";
import { AvailabilityService } from "../tienda/stock/availability.service";
import { SaleService, SaleType, applyStockEffect } from "./sale.service";

export type OperacionServiceDeps = {
    db: Database;
    userRepository: UserRepository;
    clienteRepository: ClienteRepository;
    movimientoRepository: MovimientoRepository;
    ventaRepository: VentaRepository;
    // Resuelve/valida el medio de pago de la cuenta al vender (404 si es
    // inexistente, ajeno o está dado de baja) y lista los activos.
    medioPagoService: MedioPagoService;
    depositoRepository: Pick<DepositoRepository, "moveStock">;
    // Misma disponibilidad y bloqueo que las reservas del ecommerce (ver
    // specs/016-tienda-ecommerce, tarea 5).
    availabilityService: Pick<AvailabilityService, "assertCanSell">;
    // Registro compartido de ventas (movimiento + líneas + venta + stock).
    saleService: SaleService;
    // Persiste el comprobante en la transacción y lo emite post-commit.
    comprobanteService: Pick<
        ComprobanteService,
        "emitirSiPendiente" | "resumenDeMovimiento" | "resumenesDeMovimientos"
    >;
};

// Fila cruda del listado/ficha de venta (ver `venta.repository.ts`).
type VentaConMovimiento = Awaited<ReturnType<VentaRepository["getAll"]>>["data"][number];

// Valida stock (compartida entre las cuatro operaciones: nunca duplicada por
// tipo). El rechazo es 409 con el detalle libro por libro, calculado antes de
// abrir la transacción, para que no quede stock a medio mover.
const validarStock = (libros: LibroOperacion[]): void => {
    const faltantes = libros
        .filter((libro) => libro.stock < libro.cantidad)
        .map((libro) => ({ isbn: libro.isbn, titulo: libro.titulo, pedido: libro.cantidad, disponible: libro.stock }));

    if (faltantes.length > 0) {
        throw new StockInsuficiente("No hay stock suficiente para la operación", faltantes);
    }
};

// Forma pública de una operación comercial no-venta (consignación/devolución):
// mismo contrato que exponía la transacción + su cliente.
const toOperacionPublica = (movimiento: MovimientoConDetalle, comprobante: ComprobanteResumen | null) => ({
    id: movimiento.id,
    fecha: movimiento.fecha,
    id_cliente: movimiento.id_cliente,
    type: movimiento.tipo,
    user: movimiento.user,
    nombre_cliente: movimiento.nombre_cliente,
    cuit: movimiento.cuit,
    email: movimiento.email,
    cond_fiscal: movimiento.cond_fiscal,
    tipo_cliente: movimiento.tipo_cliente,
    comprobante
});

// Toda la orquestación de un alta/consulta de operación: el controller queda
// como adapter puro que sólo parsea el body con `config.bodyParser` y llama
// acá. Las lecturas de user/cliente son de sólo ownership (sin regla de
// negocio propia), así que dependen del repository de esos módulos.
export function createOperacionService({
    db,
    userRepository,
    clienteRepository,
    movimientoRepository,
    ventaRepository,
    medioPagoService,
    depositoRepository,
    availabilityService,
    saleService,
    comprobanteService
}: OperacionServiceDeps) {
    // Forma pública de una venta: el medio se expone como objeto (nombre leído
    // en vivo) y la comisión guardada se usa para derivar el neto.
    const toVentaPublica = (
        { id_medio_pago, medio_pago_nombre, comision, ...resto }: VentaConMovimiento,
        comprobante: ComprobanteResumen | null
    ) => ({
        ...resto,
        comprobante,
        medio_pago: { id: id_medio_pago, nombre: medio_pago_nombre, comision },
        neto: calcularNeto(resto.total, comision)
    });

    // Listado de `consignacion`/`devolucion` (config.esVenta === false): sin
    // filtros ni paginación nueva.
    const listarOperaciones = async (tipo: TipoTransaccion, userId: number) => {
        const movimientos = await movimientoRepository.getByTipo(tipo, userId);
        const comprobantes = await comprobanteService.resumenesDeMovimientos(
            movimientos.map((movimiento) => movimiento.id),
            userId
        );

        return movimientos.map((movimiento) =>
            toOperacionPublica(movimiento, comprobantes.get(movimiento.id) ?? null)
        );
    };

    // Listado de `venta`/`ventaConsignacion` (config.esVenta === true): con
    // filtros combinables y paginación server-side.
    const listarVentas = async (userId: number, filter: ListVentasFilter) => {
        // El filtro por medio de la cuenta incluye los dados de baja (para
        // poder filtrar historial); un id que no es de la cuenta es 400.
        if (filter.medioPago !== undefined && !(await medioPagoService.existsEnCuenta(filter.medioPago, userId))) {
            throw new ValidationError("El medio de pago no pertenece a tu cuenta");
        }

        const { data, total } = await ventaRepository.getAll(userId, filter);
        const comprobantes = await comprobanteService.resumenesDeMovimientos(
            data.map((venta) => venta.id),
            userId
        );

        return {
            data: data.map((venta) => toVentaPublica(venta, comprobantes.get(venta.id) ?? null)),
            total
        };
    };

    const obtenerOperacion = async (config: OperacionConfig, userId: number, id: number) => {
        if (config.esVenta) {
            const venta = await ventaRepository.getById(id, userId);
            const libros = await movimientoRepository.getLibrosDe(id, userId);

            return {
                ...toVentaPublica(venta, await comprobanteService.resumenDeMovimiento(id, userId)),
                libros
            };
        }

        const movimiento = await movimientoRepository.getById(id, userId);

        return {
            ...toOperacionPublica(movimiento, await comprobanteService.resumenDeMovimiento(id, userId)),
            libros: movimiento.libros
        };
    };

    const crearOperacion = async (config: OperacionConfig, actingUserId: number, body: OperacionBody) => {
        const user = await userRepository.findOne({ id: actingUserId });
        const cliente = await clienteRepository.findOne({ id: body.cliente, user: user.id });

        // `tipo` es nullable a nivel de columna, pero todo cliente propio
        // siempre lo tiene seteado (lo fuerza cliente.service.ts#create).
        if (!config.clientValidation(cliente.tipo!)) {
            throw new ValidationError(`No se le puede hacer una ${config.tipo} a un cliente de tipo ${cliente.tipo}`);
        }

        const libros = await config.resolverLibros(body.libros, cliente, user.id, { fecha: body.fecha_venta });
        validarStock(libros);

        if (config.esVenta && (user.punto_venta === null || user.punto_venta === undefined)) {
            throw new ValidationError("Para poder vender tenés que ingresar un punto de venta, podés hacerlo en tu perfil");
        }

        // Se resuelve antes de abrir la transacción: 404 si el medio no existe,
        // es de otra cuenta o está dado de baja. `body.medio_pago` siempre está
        // (sólo `venta`/`ventaConsignacion` tienen `esVenta`).
        const medioPago = config.esVenta ? await medioPagoService.findActivo(body.medio_pago!, user.id) : null;

        const { origen, destino } = await config.obtenerExtremos(cliente, user.id);

        const data = await db.transaction(async (tx) => {
            // Revalida dentro de la transacción y con las filas de libro
            // bloqueadas: dos operaciones concurrentes por el último ejemplar
            // no pueden superar el piso (ver specs/016-tienda-ecommerce).
            if (origen.tipo === "deposito") {
                await availabilityService.assertCanSell(
                    origen.id,
                    libros.map((libro) => ({
                        id_libro: libro.id_libro,
                        isbn: libro.isbn,
                        titulo: libro.titulo,
                        cantidad: libro.cantidad
                    })),
                    user.id,
                    config.tipo === "venta",
                    tx
                );
            }

            // `tipo_cbte`/`medio_pago`/`descuento` son opcionales en
            // `OperacionBody` (sólo `createVenta`/`createVentaConsignado` los
            // exigen), pero acá siempre están: `config.esVenta` sólo es `true`
            // para esos dos tipos, cuyo `bodyParser` ya los validó. El cliente
            // vive en la venta (no en el movimiento). La comisión del medio se
            // congela en la venta al momento de vender.
            let movimiento;
            let venta: Awaited<ReturnType<VentaRepository["insert"]>> | null = null;

            if (config.esVenta && medioPago !== null) {
                const registrada = await saleService.record(
                    {
                        userId: user.id,
                        tipo: config.tipo as SaleType,
                        idCliente: cliente.id,
                        idMedioPago: medioPago.id,
                        comision: medioPago.comision,
                        tipoCbte: body.tipo_cbte!,
                        descuento: body.descuento ?? 0,
                        total: ventaRepository.calcTotal(libros, body.descuento ?? 0),
                        lines: libros,
                        origen,
                        destino
                    },
                    tx
                );
                movimiento = registrada.movimiento;
                venta = registrada.venta;
            } else {
                movimiento = await movimientoRepository.insert(
                    {
                        tipo: config.tipo,
                        origen_tipo: origen.tipo,
                        origen_deposito_id: origen.tipo === "deposito" ? origen.id : null,
                        destino_tipo: destino.tipo,
                        destino_deposito_id: destino.tipo === "deposito" ? destino.id : null,
                        user: user.id
                    },
                    tx
                );

                await movimientoRepository.insertLibros(
                    movimiento.id,
                    user.id,
                    libros.map((libro) => ({ id_libro: libro.id_libro, cantidad: libro.cantidad, precio: libro.precio })),
                    tx
                );

                if (config.fijarPrecios) {
                    await config.fijarPrecios(libros, cliente, tx);
                }

                await applyStockEffect(
                    { userId: user.id, origen, destino, lines: libros, depositoRepository },
                    tx
                );
            }

            let comprobante: ComprobanteRow | null = null;
            if (config.generarComprobante) {
                comprobante = await config.generarComprobante(
                    {
                        transaction: { id: movimiento.id, fecha: movimiento.fecha },
                        venta,
                        medioPago,
                        libros,
                        cliente,
                        user
                    },
                    tx
                );
            }

            return { movimiento, venta, comprobante };
        });

        // La factura se intenta después del commit: un fallo de AFIP no
        // revierte la venta ni el descuento de stock.
        if (data.comprobante !== null) {
            await comprobanteService.emitirSiPendiente(data.comprobante.id, user.id);
        }

        const comprobante = await comprobanteService.resumenDeMovimiento(data.movimiento.id, user.id);

        const operacionPublica = {
            id: data.movimiento.id,
            fecha: data.movimiento.fecha,
            id_cliente: cliente.id,
            type: config.tipo,
            user: user.id,
            comprobante
        };

        if (data.venta === null) return operacionPublica;

        return {
            ...operacionPublica,
            id_transaccion: data.venta.id_movimiento,
            descuento: data.venta.descuento,
            total: data.venta.total,
            medio_pago: medioPago,
            neto: calcularNeto(data.venta.total, data.venta.comision),
            tipo_cbte: data.venta.tipo_cbte
        };
    };

    return {
        listarOperaciones,
        listarVentas,
        obtenerOperacion,
        crearOperacion,
        listarMediosPago: medioPagoService.findActivos
    };
}

export type OperacionService = ReturnType<typeof createOperacionService>;
