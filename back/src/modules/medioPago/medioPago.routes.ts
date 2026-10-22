import express from "express";
import { MedioPagoController } from "./medioPago.controller";

export function createMedioPagoRoutes(controller: MedioPagoController) {
    const router = express.Router();

    router.get('/', controller.getAll);

    router.post('/', controller.create);

    router.put('/:id', controller.update);

    router.delete('/:id', controller.remove);

    return router;
}
