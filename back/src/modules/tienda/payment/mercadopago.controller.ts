import { z } from "zod";
import type { RequestHandler } from "express";
import { ok } from "../../../lib/http/responses";
import { MercadoPagoService } from "./mercadopago.service";

export type MercadoPagoControllerDeps = { service: MercadoPagoService };

const callbackQuery = z.object({
    code: z.string().trim().min(1),
    state: z.string().trim().min(1)
});

export function createMercadoPagoController({ service }: MercadoPagoControllerDeps) {
    const getStatus: RequestHandler = async (_req, res) => {
        ok(res, await service.getStatus(res.locals.user.id));
    };

    const connect: RequestHandler = async (_req, res) => {
        ok(res, await service.getConnectUrl(res.locals.user.id));
    };

    const disconnect: RequestHandler = async (_req, res) => {
        ok(res, await service.disconnect(res.locals.user.id));
    };

    const callback: RequestHandler = async (req, res) => {
        const { code, state } = callbackQuery.parse(req.query);
        const redirect = await service.callback(code, state);

        res.redirect(302, redirect);
    };

    return { getStatus, connect, disconnect, callback };
}

export type MercadoPagoController = ReturnType<typeof createMercadoPagoController>;
