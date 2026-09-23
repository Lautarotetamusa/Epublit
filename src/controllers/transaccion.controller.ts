import { Request, Response } from "express";
import { db } from "../pgDb";
import { ValidationError } from "../models/errors";
import { clienteService, generateClientPath } from "../services/cliente.service";
import { userService } from "../services/user.service";
import { transaccionService } from "../services/transaccion.service";
import { ventaService } from "../services/venta.service";
import { OperacionConfig, LibroOperacion, OperacionBody } from "../services/operacion.types";

// Valida stock (compartida entre las cuatro operaciones, ver plan "Enfoque
// técnico": nunca duplicada por tipo).
const validarStock = (libros: LibroOperacion[]): void => {
    for (const libro of libros) {
        if (libro.stock < libro.cantidad) {
            throw new ValidationError(`El libro ${libro.titulo} con isbn ${libro.isbn} no tiene suficiente stock`);
        }
    }
};

const listarOperaciones = (config: OperacionConfig) => {
    return async (_req: Request, res: Response): Promise<Response> => {
        const userId = res.locals.user.id;
        const transacciones = await transaccionService.getAll(config.tipo, userId);

        return res.json(
            transacciones.map((t) => ({
                ...t,
                file_path: transaccionService.buildFileUrl(t.file_path, config.filesFolder)
            }))
        );
    };
};

const obtenerOperacion = (config: OperacionConfig) => {
    return async (req: Request, res: Response): Promise<Response> => {
        const id = Number(req.params.id);
        if (!id) throw new ValidationError("El id debe ser un numero");

        const userId = res.locals.user.id;
        const transaction = await transaccionService.getById(id, userId);
        const libros = await transaccionService.getLibros(id);

        const ventaExtra = config.esVenta ? await ventaService.getById(id, userId) : {};

        return res.json({
            ...transaction,
            ...ventaExtra,
            file_path: transaccionService.buildFileUrl(transaction.file_path, config.filesFolder),
            libros
        });
    };
};

const crearOperacion = (config: OperacionConfig) => {
    return async (req: Request, res: Response): Promise<Response> => {
        const user = await userService.findOne({ id: res.locals.user.id });

        const body = config.bodyParser.parse(req.body) as OperacionBody;
        const cliente = await clienteService.findOne({ id: body.cliente, user: user.id });

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
            const transaction = await transaccionService.insert(
                {
                    type: config.tipo,
                    id_cliente: cliente.id,
                    file_path: config.tipo === "devolucion" ? "" : generateClientPath(cliente.razon_social),
                    user: user.id
                },
                tx
            );
            await transaccionService.saveLibros(libros, transaction.id, tx);

            // `tipo_cbte`/`medio_pago`/`descuento` son opcionales en
            // `OperacionBody` (sólo `createVenta`/`createVentaConsignado` los
            // exigen), pero acá siempre están: `config.esVenta` sólo es
            // `true` para esos dos tipos, cuyo `bodyParser` ya los validó.
            const venta = config.esVenta
                ? await ventaService.insert(
                      transaction.id,
                      {
                          descuento: body.descuento ?? 0,
                          medio_pago: body.medio_pago!,
                          tipo_cbte: body.tipo_cbte!,
                          total: ventaService.calcTotal(libros, body.descuento ?? 0)
                      },
                      tx
                  )
                : null;

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

        return res.status(201).json({
            success: true,
            message: `Se realizó la ${config.tipo} correctamente`,
            data: {
                ...data.transaction,
                ...(data.venta ?? {}),
                file_path: transaccionService.buildFileUrl(data.transaction.file_path, config.filesFolder)
            }
        });
    };
};

export default {
    listarOperaciones,
    obtenerOperacion,
    crearOperacion
};
