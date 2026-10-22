import { RequestHandler } from "express";
import { depositoValidator } from "./deposito.validator";
import { DepositoService } from "./deposito.service";
import { created, ok, updated, noContent } from "../../lib/http/responses";

// El controller sólo adapta HTTP: parsea/valida con zod, le pasa los datos al
// service y elige el helper de respuesta. Las reglas de negocio (no borrar el
// principal ni un depósito con stock) viven en deposito.service.ts.
export type DepositoControllerDeps = {
    service: DepositoService;
};

export function createDepositoController({ service }: DepositoControllerDeps) {
    const create: RequestHandler = async (req, res) => {
        const body = depositoValidator.insert.parse(req.body);
        const deposito = await service.create(body, res.locals.user.id);

        created(res, deposito, "Depósito creado correctamente");
    };

    const getAll: RequestHandler = async (req, res) => {
        const depositos = await service.findAll(res.locals.user.id);

        ok(res, depositos);
    };

    const getOne: RequestHandler = async (req, res) => {
        const { id } = depositoValidator.pk.parse(req.params);
        const deposito = await service.findOne(id, res.locals.user.id);

        ok(res, deposito);
    };

    const update: RequestHandler = async (req, res) => {
        const { id } = depositoValidator.pk.parse(req.params);
        const body = depositoValidator.update.parse(req.body);
        const deposito = await service.update(id, res.locals.user.id, body);

        updated(res, deposito, "Depósito actualizado correctamente");
    };

    const remove: RequestHandler = async (req, res) => {
        const { id } = depositoValidator.pk.parse(req.params);
        await service.remove(id, res.locals.user.id);

        noContent(res);
    };

    const getLibros: RequestHandler = async (req, res) => {
        const { id } = depositoValidator.pk.parse(req.params);
        const { deposito, libros } = await service.getLibros(id, res.locals.user.id);

        ok(res, { deposito, libros });
    };

    return {
        create,
        getAll,
        getOne,
        update,
        remove,
        getLibros
    };
}

export type DepositoController = ReturnType<typeof createDepositoController>;
