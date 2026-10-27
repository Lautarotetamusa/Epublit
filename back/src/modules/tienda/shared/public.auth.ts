import { NextFunction, Request, RequestHandler, Response } from "express";
import { IntegrationService } from "../integration/integration.service";
import { sendPublicError } from "./public.errors";

export type PublicAuthDeps = {
    service: IntegrationService;
};

const CORS_HEADERS = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-API-Key, Idempotency-Key, X-Pedido-Referencia",
    "Access-Control-Max-Age": "600"
};

function applyCors(res: Response, origen: string): void {
    res.setHeader("Access-Control-Allow-Origin", origen);
    res.setHeader("Vary", "Origin");
    for (const [header, value] of Object.entries(CORS_HEADERS)) {
        res.setHeader(header, value);
    }
}

function normalizeOrigin(origen: string | undefined): string | undefined {
    if (origen === undefined) return undefined;

    try {
        return new URL(origen).origin;
    } catch {
        return origen;
    }
}

export function createPublicAuth({ service }: PublicAuthDeps): RequestHandler {
    const resolvePreflight = async (req: Request): Promise<boolean> => {
        const origen = normalizeOrigin(req.header("origin"));
        if (origen === undefined) return false;

        const apiKey = req.header("x-api-key");
        if (apiKey) {
            try {
                const integracion = await service.authenticate(apiKey);
                service.assertOrigin(integracion, origen);
                return true;
            } catch {
                return service.originHasActiveIntegration(origen);
            }
        }

        return service.originHasActiveIntegration(origen);
    };

    return async (req: Request, res: Response, next: NextFunction) => {
        const origen = normalizeOrigin(req.header("origin"));

        // El preflight no lleva la API key (es un header custom): se autoriza
        // por origen contra las integraciones activas.
        if (req.method === "OPTIONS") {
            const permitido = await resolvePreflight(req);
            if (!permitido) {
                return sendPublicError(res, 403, "origen_no_permitido", "El origen no está permitido");
            }

            if (origen !== undefined) applyCors(res, origen);
            return res.status(204).send();
        }

        try {
            const integracion = await service.authenticate(req.header("x-api-key"));
            service.assertOrigin(integracion, origen);

            if (origen !== undefined) applyCors(res, origen);

            res.locals.integracion = integracion;
            await service.registerUsage(integracion.id, integracion.userId);

            next();
        } catch (err) {
            next(err);
        }
    };
}
