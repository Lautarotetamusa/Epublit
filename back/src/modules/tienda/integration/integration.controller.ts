import { RequestHandler } from "express";
import { created, ok, updated } from "../../../lib/http/responses";
import { IntegrationService } from "./integration.service";
import { integrationValidator } from "./integration.validator";

export type IntegrationControllerDeps = {
    service: IntegrationService;
};

export function createIntegrationController({ service }: IntegrationControllerDeps) {
    const getAll: RequestHandler = async (req, res) => {
        const integraciones = await service.findAll(res.locals.user.id);
        ok(res, { integraciones });
    };

    const create: RequestHandler = async (req, res) => {
        const body = integrationValidator.create.parse(req.body);
        const integracion = await service.create(body, res.locals.user.id);

        created(res, integracion, "Integración creada correctamente");
    };

    const update: RequestHandler = async (req, res) => {
        const id = integrationValidator.id.parse(req.params.id);
        const body = integrationValidator.update.parse(req.body);

        const integracion = await service.update(id, res.locals.user.id, body);

        updated(res, integracion, "Integración actualizada correctamente");
    };

    const revoke: RequestHandler = async (req, res) => {
        const id = integrationValidator.id.parse(req.params.id);
        const integracion = await service.revoke(id, res.locals.user.id);

        ok(res, integracion, "Integración revocada correctamente");
    };

    return {
        getAll,
        create,
        update,
        revoke
    };
}

export type IntegrationController = ReturnType<typeof createIntegrationController>;
