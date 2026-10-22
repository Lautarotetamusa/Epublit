import express from "express";
import { LiquidacionController } from "./liquidacion.controller";

export function createLiquidacionRoutes(controller: LiquidacionController) {
    const router = express.Router();

    router.get('/', controller.getLiquidacion);

    return router;
}
