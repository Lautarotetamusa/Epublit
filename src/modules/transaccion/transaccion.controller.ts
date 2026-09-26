import { RequestHandler } from "express";
import { ValidationError } from "../../lib/http/errors";
import { OperacionConfig, OperacionBody } from "./operacion.types";
import { OperacionService } from "./operacion.service";
import { created, ok } from "../../lib/http/responses";

export type TransaccionControllerDeps = {
    service: OperacionService;
};

export function createTransaccionController({ service }: TransaccionControllerDeps) {
    const listarOperaciones = (config: OperacionConfig): RequestHandler => async (_req, res) => {
        const userId = res.locals.user.id;
        const items = await service.listarOperaciones(config, userId);

        ok(res, items);
    };

    const obtenerOperacion = (config: OperacionConfig): RequestHandler => async (req, res) => {
        const id = Number(req.params.id);
        if (!id) throw new ValidationError("El id debe ser un numero");

        const userId = res.locals.user.id;
        const result = await service.obtenerOperacion(config, userId, id);

        ok(res, result);
    };

    const crearOperacion = (config: OperacionConfig): RequestHandler => async (req, res) => {
        const body = config.bodyParser.parse(req.body) as OperacionBody;
        const userId = res.locals.user.id;

        const result = await service.crearOperacion(config, userId, body);

        created(res, result, `Se realizó la ${config.tipo} correctamente`);
    };

    return {
        listarOperaciones,
        obtenerOperacion,
        crearOperacion
    };
}

export type TransaccionController = ReturnType<typeof createTransaccionController>;
