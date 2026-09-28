import { RequestHandler } from "express";
import { liquidacionValidator } from "./liquidacion.validator";
import { LiquidacionService } from "./liquidacion.service";
import { ok } from "../../lib/http/responses";

export type LiquidacionControllerDeps = {
    service: LiquidacionService;
};

export function createLiquidacionController({ service }: LiquidacionControllerDeps) {
    const getLiquidacion: RequestHandler = async (req, res) => {
        const { desde, hasta } = liquidacionValidator.query.parse(req.query);
        const userId = res.locals.user.id;

        const liquidacion = await service.generar(userId, desde, hasta);

        ok(res, liquidacion);
    };

    return { getLiquidacion };
}

export type LiquidacionController = ReturnType<typeof createLiquidacionController>;
