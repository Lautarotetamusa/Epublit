import { RequestHandler } from "express";
import { z } from "zod";
import { newPagination } from "bradb";
import { clienteValidator } from "./cliente.validator";
import { ClienteService } from "./cliente.service";
import { ClienteStockService } from "./clienteStock.service";
import { NotImplemented } from "../../lib/http/errors";
import { created, ok, updated, deleted, list } from "../../lib/http/responses";

// El controller sólo adapta HTTP: parsea/valida con zod, le pasa los datos
// al service y elige qué helper de respuesta usar. Las reglas de negocio
// (no cargarse a uno mismo, no duplicar cuit, no tocar CONSUMIDOR
// FINAL/MOSTRADOR, etc.) viven en cliente.service.ts.
export type ClienteControllerDeps = {
    service: ClienteService;
    stockService: ClienteStockService;
};

export function createClienteController({ service, stockService }: ClienteControllerDeps) {
    const create: RequestHandler = async (req, res) => {
        const body = clienteValidator.insert.parse(req.body);
        const userId = res.locals.user.id;

        const cliente = await service.create(body, userId, res.locals.user.cuit);

        created(res, cliente, "Cliente creado correctamente");
    };

    const update: RequestHandler = async (req, res) => {
        const { id } = clienteValidator.pk.parse(req.params);
        const userId = res.locals.user.id;
        const body = clienteValidator.update.parse(req.body);

        const cliente = await service.update(id, userId, body);

        updated(res, cliente, "Cliente actualizado correctamente");
    };

    const remove: RequestHandler = async (req, res) => {
        const { id } = clienteValidator.pk.parse(req.params);
        const userId = res.locals.user.id;

        await service.remove(id, userId);

        deleted(res, `Cliente con id ${id} eliminado correctamente`);
    };

    const getAll: RequestHandler = async (req, res) => {
        const userId = res.locals.user.id;
        const pagination = newPagination(req.query);
        const { tipo } = clienteValidator.filter.pick({ tipo: true }).parse(req.query);

        const clientes = await service.findAll(userId, tipo);
        list(res, clientes, pagination);
    };

    const getOne: RequestHandler = async (req, res) => {
        const { id } = clienteValidator.pk.parse(req.params);
        const userId = res.locals.user.id;

        const cliente = await service.findOne({ id, user: userId });
        ok(res, cliente);
    };

    const getStock: RequestHandler = async (req, res) => {
        const { id } = clienteValidator.pk.parse(req.params);
        const { fecha } = z.object({ fecha: z.coerce.date().optional() }).parse(req.query);
        const userId = res.locals.user.id;

        const libros = await stockService.getStock(id, userId, fecha);
        ok(res, libros);
    };

    const updatePrecios: RequestHandler = async (req, res) => {
        const { id } = clienteValidator.pk.parse(req.params);
        const userId = res.locals.user.id;

        const libros = await stockService.syncPrecios(id, userId);

        updated(res, libros, `Libros del cliente ${id} actualizados correctamente`);
    };

    // `GET /cliente/:id/ventas` depende de las tablas de ventas/transacciones,
    // que todavía no migran a Postgres (ver plan, "Enfoque técnico"); la ruta se
    // mantiene registrada pero sin implementación real hasta que esos módulos migren.
    const getVentas: RequestHandler = async () => {
        throw new NotImplemented("GET /cliente/:id/ventas no está migrado; se resuelve junto con venta/transaccion");
    };

    return {
        create,
        update,
        getStock,
        updatePrecios,
        getVentas,
        remove,
        getAll,
        getOne
    };
}

export type ClienteController = ReturnType<typeof createClienteController>;
