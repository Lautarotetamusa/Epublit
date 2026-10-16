import { RequestHandler } from "express";
import { ok } from "../../lib/http/responses";
import { liquidacionesValidator, LiquidacionesService } from "../liquidaciones";

// El reporte del período es la previsualización de una liquidación persistida:
// reusa el mismo cálculo (ventas del período todavía no cubiertas) y agrega
// `excluidas`, sin duplicar la lógica en este módulo.
export type LiquidacionControllerDeps = {
    service: Pick<LiquidacionesService, "reporte">;
};

export function createLiquidacionController({ service }: LiquidacionControllerDeps) {
    const getLiquidacion: RequestHandler = async (req, res) => {
        const { desde, hasta } = liquidacionesValidator.rango.parse(req.query);
        const reporte = await service.reporte(res.locals.user.id, desde, hasta);

        ok(res, reporte);
    };

    return { getLiquidacion };
}

export type LiquidacionController = ReturnType<typeof createLiquidacionController>;
