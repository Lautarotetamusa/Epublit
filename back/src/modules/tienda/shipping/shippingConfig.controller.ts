import { RequestHandler } from "express";
import { ok, updated } from "../../../lib/http/responses";
import { ShippingConfigService } from "./shippingConfig.service";
import { shippingConfigValidator } from "./shippingConfig.validator";

export type ShippingConfigControllerDeps = {
    service: ShippingConfigService;
};

export function createShippingConfigController({ service }: ShippingConfigControllerDeps) {
    const get: RequestHandler = async (_req, res) => {
        ok(res, await service.getConfig(res.locals.user.id));
    };

    const update: RequestHandler = async (req, res) => {
        const body = shippingConfigValidator.update.parse(req.body);
        updated(res, await service.save(res.locals.user.id, body));
    };

    const testConnection: RequestHandler = async (req, res) => {
        const { api } = shippingConfigValidator.testConnection.parse(req.body);
        const result = await service.testConnection(res.locals.user.id, api);

        res.status(result.ok ? 200 : 422).json(result);
    };

    return { get, update, testConnection };
}

export type ShippingConfigController = ReturnType<typeof createShippingConfigController>;
