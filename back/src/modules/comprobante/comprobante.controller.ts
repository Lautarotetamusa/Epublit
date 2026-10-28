import { RequestHandler } from "express";
import { NotFound } from "bradb";
import { ok } from "../../lib/http/responses";
import { comprobantePk } from "./comprobante.validator";
import type { ComprobanteService } from "./comprobante.service";

export type ComprobanteControllerDeps = {
    service: ComprobanteService;
};

// El contrato trata un id inválido como "no existe" (404), no como body
// inválido (400).
const idDe = (params: unknown, rawId: string): number => {
    const parsed = comprobantePk.safeParse(params);
    if (!parsed.success) {
        throw new NotFound(`No se encontró el comprobante con id ${rawId}`);
    }

    return parsed.data.id;
};

export function createComprobanteController({ service }: ComprobanteControllerDeps) {
    const getOne: RequestHandler = async (req, res) => {
        ok(res, await service.getById(idDe(req.params, String(req.params.id)), res.locals.user.id));
    };

    const reintentar: RequestHandler = async (req, res) => {
        ok(res, await service.reintentar(idDe(req.params, String(req.params.id)), res.locals.user.id));
    };

    return {
        getOne,
        reintentar
    };
}

export type ComprobanteController = ReturnType<typeof createComprobanteController>;
