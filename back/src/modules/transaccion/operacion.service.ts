import { join } from "path";
import { Database, Tx } from "../../db/client";
import { StockInsuficiente, ValidationError } from "../../lib/http/errors";
import { calcularNeto } from "../../lib/venta";
import { Storage } from "../../lib/storage/storage";
import { UserRepository } from "../user";
import { ClienteRepository, generateClientPath } from "../cliente";
import { DepositoRepository } from "../deposito";
import { MedioPagoService } from "../medioPago";
import { MovimientoConDetalle, MovimientoRepository } from "../movimiento";
import { VentaRepository } from "./venta.repository";
import { ListVentasFilter } from "./venta.validator";
import { TipoTransaccion } from "./transaccion.validator";
import { OperacionConfig, LibroOperacion, OperacionBody, ExtremoOperacion } from "./operacion.types";

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
    storage: Storage;
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
const toOperacionPublica = (movimiento: MovimientoConDetalle) => ({
    id: movimiento.id,
    fecha: movimiento.fecha,
    id_cliente: movimiento.id_cliente,
    file_path: movimiento.file_path,
    type: movimiento.tipo,
    user: movimiento.user,
    nombre_cliente: movimiento.nombre_cliente,
    cuit: movimiento.cuit,
    email: movimiento.email,
    cond_fiscal: movimiento.cond_fiscal,
    tipo_cliente: movimiento.tipo_cliente
});

// Toda la orquestación de un alta/consulta de operación: el controller queda
// como adapter puro que sólo parsea el body con `config.bodyParser` y llama
// acá. Las lecturas de user/cliente son de sólo ownership (sin regla de
// negocio propia), así que dependen del repository de esos módulos.
export function createOperacionService({ db, userRepository, clienteRepository, movimientoRepository, ventaRepository, medioPagoService, depositoRepository, storage }: OperacionServiceDeps) {
    const urlDeArchivo = (filePath: string | null): string | null =>
        filePath === null ? null : storage.getUrl(filePath);

    // Forma pública de una venta: el medio se expone como objeto (nombre leído
    // en vivo) y la comisión guardada se usa para derivar el neto.
    const toVentaPublica = ({ id_medio_pago, medio_pago_nombre, comision, file_path, ...resto }: VentaConMovimiento) => ({
        ...resto,
        file_path: urlDeArchivo(file_path),
        medio_pago: { id: id_medio_pago, nombre: medio_pago_nombre, comision },
        neto: calcularNeto(resto.total, comision)
    });

    // Listado de `consignacion`/`devolucion` (config.esVenta === false): sin
    // filtros ni paginación nueva.
    const listarOperaciones = async (tipo: TipoTransaccion, userId: number) => {
        const movimientos = await movimientoRepository.getByTipo(tipo, userId);

        return movimientos.map((movimiento) => ({
            ...toOperacionPublica(movimiento),
            file_path: urlDeArchivo(movimiento.file_path)
        }));
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

        return { data: data.map(toVentaPublica), total };
    };

    const obtenerOperacion = async (config: OperacionConfig, userId: number, id: number) => {
        if (config.esVenta) {
            const venta = await ventaRepository.getById(id, userId);
            const libros = await movimientoRepository.getLibrosDe(id, userId);

            return { ...toVentaPublica(venta), libros };
        }

        const movimiento = await movimientoRepository.getById(id, userId);

        return {
            ...toOperacionPublica(movimiento),
            file_path: urlDeArchivo(movimiento.file_path),
            libros: movimiento.libros
        };
    };

    // Aplica el efecto de stock del movimiento: resta del origen y suma en el
    // destino cuando cada extremo es un depósito (el exterior no mueve nada).
    const aplicarStock = async (
        origen: ExtremoOperacion,
        destino: ExtremoOperacion,
        libros: LibroOperacion[],
        userId: number,
        tx: Tx
    ): Promise<void> => {
        if (origen.tipo === "deposito") {
            for (const libro of libros) {
                await depositoRepository.moveStock(origen.id, libro.id_libro, userId, -libro.cantidad, tx);
            }
        }
        if (destino.tipo === "deposito") {
            for (const libro of libros) {
                await depositoRepository.moveStock(destino.id, libro.id_libro, userId, libro.cantidad, tx);
            }
        }
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
        const filePath = join(config.filesFolder, generateClientPath(cliente.razon_social));

        const data = await db.transaction(async (tx) => {
            const movimiento = await movimientoRepository.insert(
                {
                    tipo: config.tipo,
                    origen_tipo: origen.tipo,
                    origen_deposito_id: origen.tipo === "deposito" ? origen.id : null,
                    destino_tipo: destino.tipo,
                    destino_deposito_id: destino.tipo === "deposito" ? destino.id : null,
                    file_path: filePath,
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

            // `tipo_cbte`/`medio_pago`/`descuento` son opcionales en
            // `OperacionBody` (sólo `createVenta`/`createVentaConsignado` los
            // exigen), pero acá siempre están: `config.esVenta` sólo es `true`
            // para esos dos tipos, cuyo `bodyParser` ya los validó. El cliente
            // vive en la venta (no en el movimiento). La comisión del medio se
            // congela en la venta al momento de vender.
            let venta: Awaited<ReturnType<VentaRepository["insert"]>> | null = null;
            if (config.esVenta && medioPago !== null) {
                venta = await ventaRepository.insert(
                    movimiento.id,
                    {
                        id_cliente: cliente.id,
                        descuento: body.descuento ?? 0,
                        id_medio_pago: medioPago.id,
                        comision: medioPago.comision,
                        tipo_cbte: body.tipo_cbte!,
                        total: ventaRepository.calcTotal(libros, body.descuento ?? 0)
                    },
                    tx
                );
            }

            if (config.fijarPrecios) {
                await config.fijarPrecios(libros, cliente, tx);
            }

            await aplicarStock(origen, destino, libros, user.id, tx);

            if (config.generarComprobante !== null) {
                await config.generarComprobante(
                    { transaction: { id: movimiento.id, file_path: filePath }, venta, medioPago, libros, cliente, user },
                    tx
                );
            }

            return { movimiento, venta };
        });

        const operacionPublica = {
            id: data.movimiento.id,
            fecha: data.movimiento.fecha,
            id_cliente: cliente.id,
            file_path: urlDeArchivo(filePath),
            type: config.tipo,
            user: user.id
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
