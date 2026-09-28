import { join } from "path";
import { Database } from "../../db/client";
import { ValidationError } from "../../lib/http/errors";
import { Storage } from "../../lib/storage/storage";
import { UserRepository } from "../user";
import { ClienteRepository, generateClientPath } from "../cliente";
import { TransaccionRepository } from "./transaccion.repository";
import { VentaRepository } from "./venta.repository";
import { ListVentasFilter } from "./venta.validator";
import { OperacionConfig, LibroOperacion, OperacionBody } from "./operacion.types";

export type OperacionServiceDeps = {
    db: Database;
    userRepository: UserRepository;
    clienteRepository: ClienteRepository;
    transaccionRepository: TransaccionRepository;
    ventaRepository: VentaRepository;
    storage: Storage;
};

// Valida stock (compartida entre las cuatro operaciones: nunca duplicada por tipo).
const validarStock = (libros: LibroOperacion[]): void => {
    for (const libro of libros) {
        if (libro.stock < libro.cantidad) {
            throw new ValidationError(`El libro ${libro.titulo} con isbn ${libro.isbn} no tiene suficiente stock`);
        }
    }
};

// Toda la orquestación de un alta/consulta de operación (antes vivía en
// transaccion.controller.ts): el controller queda como adapter puro que sólo
// parsea el body con `config.bodyParser` y llama acá. Las lecturas de
// user/cliente son de sólo ownership (sin regla de negocio propia), así que
// dependen del repository de esos módulos, no de su service.
export function createOperacionService({ db, userRepository, clienteRepository, transaccionRepository, ventaRepository, storage }: OperacionServiceDeps) {
    // Un `file_path` vacío es "no generó archivo" (ver `devolucion` en
    // `operacion.config.ts`): no tiene key en `storage`, así que no se le
    // arma URL.
    const buildFileUrl = (fileName: string, folder: string): string =>
        fileName === "" ? fileName : storage.getUrl(join(folder, fileName));

    // Listado de `consignacion`/`devolucion` (config.esVenta === false): sin
    // filtros ni paginación nueva (ver plan, "Ambigüedad" — esos dos tipos
    // no forman parte de este feature).
    const listarOperaciones = async (config: OperacionConfig, userId: number) => {
        const transacciones = await transaccionRepository.getAll(config.tipo, userId);

        return transacciones.map((t) => ({
            ...t,
            file_path: buildFileUrl(t.file_path, config.filesFolder)
        }));
    };

    // Listado de `venta`/`ventaConsignacion` (config.esVenta === true): con
    // filtros combinables y paginación server-side (ver plan, "Diseño de
    // API"). `config` sólo se usa acá por `filesFolder` (igual en ambos
    // tipos, "facturas").
    const listarVentas = async (config: OperacionConfig, userId: number, filter: ListVentasFilter) => {
        const { data, total } = await ventaRepository.getAll(userId, filter);

        return {
            data: data.map((t) => ({ ...t, file_path: buildFileUrl(t.file_path, config.filesFolder) })),
            total
        };
    };

    const obtenerOperacion = async (config: OperacionConfig, userId: number, id: number) => {
        const transaction = await transaccionRepository.getById(id, userId);
        const libros = await transaccionRepository.getLibros(id);

        const ventaExtra = config.esVenta ? await ventaRepository.getById(id, userId) : {};

        return {
            ...transaction,
            ...ventaExtra,
            file_path: buildFileUrl(transaction.file_path, config.filesFolder),
            libros
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

        const data = await db.transaction(async (tx) => {
            const transaction = await transaccionRepository.insert(
                {
                    type: config.tipo,
                    id_cliente: cliente.id,
                    file_path: config.tipo === "devolucion" ? "" : generateClientPath(cliente.razon_social),
                    user: user.id
                },
                tx
            );
            await transaccionRepository.saveLibros(libros, transaction.id, tx);

            // `tipo_cbte`/`medio_pago`/`descuento` son opcionales en
            // `OperacionBody` (sólo `createVenta`/`createVentaConsignado` los
            // exigen), pero acá siempre están: `config.esVenta` sólo es
            // `true` para esos dos tipos, cuyo `bodyParser` ya los validó.
            let venta = null;
            if (config.esVenta) {
                venta = await ventaRepository.insert(
                    transaction.id,
                    {
                        descuento: body.descuento ?? 0,
                        medio_pago: body.medio_pago!,
                        tipo_cbte: body.tipo_cbte!,
                        total: ventaRepository.calcTotal(libros, body.descuento ?? 0)
                    },
                    tx
                );
            }

            await config.moverStock(libros, cliente, tx);

            const transactionConCliente = {
                ...transaction,
                nombre_cliente: cliente.nombre,
                cuit: cliente.cuit,
                email: cliente.email,
                cond_fiscal: cliente.cond_fiscal,
                tipo_cliente: cliente.tipo
            };

            if (config.generarComprobante !== null) {
                await config.generarComprobante(
                    { transaction: transactionConCliente, venta, libros, cliente, user },
                    tx
                );
            }

            return { transaction, venta };
        });

        return {
            ...data.transaction,
            ...(data.venta ?? {}),
            file_path: buildFileUrl(data.transaction.file_path, config.filesFolder)
        };
    };

    return {
        listarOperaciones,
        listarVentas,
        obtenerOperacion,
        crearOperacion
    };
}

export type OperacionService = ReturnType<typeof createOperacionService>;
