import { RequestHandler } from "express";
import { created, deleted, updated } from "../../lib/http/responses";
import { rolValidator } from "./rol.validator";
import { RolService } from "./rol.service";

// El controller sólo adapta HTTP: parsea/valida con zod, llama al service y
// elige el helper de respuesta. Las reglas de negocio (nombre repetido entre
// activos, bloqueo de baja por uso) viven en rol.service.ts.
export type RolControllerDeps = {
    service: RolService;
};

export function createRolController({ service }: RolControllerDeps) {
    // Contrato: array pelado (sin sobre `{success,data}`), igual que
    // `GET /medio_pago`, que consumen los formularios y selectores.
    const getAll: RequestHandler = async (_, res) => {
        const roles = await service.findActivos(res.locals.user.id);

        res.json(roles);
    };

    const create: RequestHandler = async (req, res) => {
        const body = rolValidator.insert.parse(req.body);
        const rol = await service.create(body, res.locals.user.id);

        created(res, rol, "Rol creado correctamente");
    };

    const update: RequestHandler = async (req, res) => {
        const { id } = rolValidator.pk.parse(req.params);
        const body = rolValidator.update.parse(req.body);
        const rol = await service.update(id, res.locals.user.id, body);

        updated(res, rol, "Rol actualizado correctamente");
    };

    const remove: RequestHandler = async (req, res) => {
        const { id } = rolValidator.pk.parse(req.params);
        await service.remove(id, res.locals.user.id);

        deleted(res, "Rol dado de baja correctamente");
    };

    return {
        getAll,
        create,
        update,
        remove
    };
}

export type RolController = ReturnType<typeof createRolController>;
