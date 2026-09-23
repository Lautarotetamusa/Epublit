import { Request, Response } from "express";
import { z } from "zod";
import { clienteService } from "../services/cliente.service";
import { clienteStockService } from "../services/clienteStock.service";
import { clienteValidator } from "../validators/cliente.validator";
import { Duplicated, NotImplemented, ValidationError } from "../models/errors";

const create = async (req: Request, res: Response): Promise<Response> => {
    const body = clienteValidator.insert.parse(req.body);
    const userId = res.locals.user.id;

    if (body.cuit === res.locals.user.cuit) {
        throw new ValidationError("No podes cargarte a vos mismo como cliente");
    }

    if (await clienteService.existsByCuit(body.cuit, userId)) {
        throw new Duplicated(`El cliente con cuit ${body.cuit} ya existe`);
    }

    const cliente = await clienteService.create(body, userId);

    return res.status(201).json({
        success: true,
        message: "Cliente creado correctamente",
        data: cliente
    });
};

const update = async (req: Request, res: Response): Promise<Response> => {
    const { id } = clienteValidator.pk.parse(req.params);
    const userId = res.locals.user.id;
    const body = clienteValidator.update.parse(req.body);

    const cliente = await clienteService.findOne({ id, user: userId });

    if (body.cuit && body.cuit !== cliente.cuit && (await clienteService.existsByCuit(body.cuit, userId))) {
        throw new Duplicated(`El cliente con cuit ${body.cuit} ya existe`);
    }

    const updated = await clienteService.update(id, userId, body);

    return res.status(201).json({
        success: true,
        message: "Cliente actualizado correctamente",
        data: updated
    });
};

const delet = async (req: Request, res: Response): Promise<Response> => {
    const { id } = clienteValidator.pk.parse(req.params);
    const userId = res.locals.user.id;

    await clienteService.remove(id, userId);

    return res.json({
        success: true,
        message: `Cliente con id ${id} eliminado correctamente`
    });
};

const getAll = async (req: Request, res: Response): Promise<Response> => {
    const userId = res.locals.user.id;
    const { tipo } = clienteValidator.filter.pick({ tipo: true }).parse(req.query);

    const clientes = await clienteService.findAll(userId, tipo);
    return res.json(clientes);
};

const getOne = async (req: Request, res: Response): Promise<Response> => {
    const { id } = clienteValidator.pk.parse(req.params);
    const userId = res.locals.user.id;

    const cliente = await clienteService.findOne({ id, user: userId });
    return res.json(cliente);
};

const getStock = async (req: Request, res: Response): Promise<Response> => {
    const { id } = clienteValidator.pk.parse(req.params);
    const { fecha } = z.object({ fecha: z.coerce.date().optional() }).parse(req.query);
    const userId = res.locals.user.id;

    const libros = await clienteStockService.getStock(id, userId, fecha);
    return res.json(libros);
};

const updatePrecios = async (req: Request, res: Response): Promise<Response> => {
    const { id } = clienteValidator.pk.parse(req.params);
    const userId = res.locals.user.id;

    const libros = await clienteStockService.syncPrecios(id, userId);

    return res.json({
        success: true,
        message: `Libros del cliente ${id} actualizados correctamente`,
        data: libros
    });
};

// `GET /cliente/:id/ventas` depende de las tablas de ventas/transacciones,
// que todavía no migran a Postgres (ver plan, "Enfoque técnico"); la ruta se
// mantiene registrada pero sin implementación real hasta que esos módulos migren.
const getVentas = async (): Promise<never> => {
    throw new NotImplemented("GET /cliente/:id/ventas no está migrado; se resuelve junto con venta/transaccion");
};

export default {
    create,
    update,
    getStock,
    updatePrecios,
    getVentas,
    delet,
    getAll,
    getOne
};
