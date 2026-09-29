import { RequestHandler } from "express";
import { movimientoValidator } from "./movimiento.validator";
import { MovimientoService } from "./movimiento.service";
import { created, ok } from "../../lib/http/responses";

// El controller sólo adapta HTTP: parsea/valida con zod, le pasa los datos al
// service y elige el helper de respuesta. La atomicidad y la validación de
// saldo viven en movimiento.service.ts.
export type MovimientoControllerDeps = {
    service: MovimientoService;
};

export function createMovimientoController({ service }: MovimientoControllerDeps) {
    const create: RequestHandler = async (req, res) => {
        const body = movimientoValidator.insert.parse(req.body);
        const movimiento = await service.registrar(body, res.locals.user.id);

        created(res, movimiento, "Movimiento registrado correctamente");
    };

    const getAll: RequestHandler = async (req, res) => {
        const { pagina, porPagina } = movimientoValidator.paginacion.parse(req.query);
        const resultado = await service.listar(res.locals.user.id, pagina, porPagina);

        ok(res, resultado);
    };

    const getOne: RequestHandler = async (req, res) => {
        const { id } = movimientoValidator.pk.parse(req.params);
        const movimiento = await service.obtener(id, res.locals.user.id);

        ok(res, movimiento);
    };

    return {
        create,
        getAll,
        getOne
    };
}

export type MovimientoController = ReturnType<typeof createMovimientoController>;
