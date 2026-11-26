import { RequestHandler } from "express";
import { created, deleted, updated } from "../../lib/http/responses";
import { tipoEdicionValidator } from "./tipoEdicion.validator";
import { TipoEdicionService } from "./tipoEdicion.service";

// El controller sólo adapta HTTP: parsea/valida con zod, llama al service y
// elige el helper de respuesta. Las reglas de negocio (nombre repetido entre
// activos) viven en tipoEdicion.service.ts.
export type TipoEdicionControllerDeps = {
    service: TipoEdicionService;
};

export function createTipoEdicionController({ service }: TipoEdicionControllerDeps) {
    // Contrato: array pelado (sin sobre `{success,data}`), igual que
    // `GET /rol`, que consumen los selectores del formulario de libro.
    const getAll: RequestHandler = async (_, res) => {
        const tipos = await service.findActivos(res.locals.user.id);

        res.json(tipos);
    };

    const create: RequestHandler = async (req, res) => {
        const body = tipoEdicionValidator.insert.parse(req.body);
        const tipo = await service.create(body, res.locals.user.id);

        created(res, tipo, "Tipo de edición creado correctamente");
    };

    const update: RequestHandler = async (req, res) => {
        const { id } = tipoEdicionValidator.pk.parse(req.params);
        const body = tipoEdicionValidator.update.parse(req.body);
        const tipo = await service.update(id, res.locals.user.id, body);

        updated(res, tipo, "Tipo de edición actualizado correctamente");
    };

    const remove: RequestHandler = async (req, res) => {
        const { id } = tipoEdicionValidator.pk.parse(req.params);
        await service.remove(id, res.locals.user.id);

        deleted(res, "Tipo de edición dado de baja correctamente");
    };

    return {
        getAll,
        create,
        update,
        remove
    };
}

export type TipoEdicionController = ReturnType<typeof createTipoEdicionController>;
