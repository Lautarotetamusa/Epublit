import express from "express";
import { LiquidacionesController } from "./liquidaciones.controller";

export function createLiquidacionesRoutes(controller: LiquidacionesController) {
    const router = express.Router();

    router.get('/', controller.getAll);

    router.post('/', controller.generar);

    router.get('/:id', controller.getFicha);

    router.post('/:id/personas/:idPersona/pagos', controller.registrarPago);

    router.delete('/:id/pagos/:idPago', controller.anularPago);

    return router;
}
