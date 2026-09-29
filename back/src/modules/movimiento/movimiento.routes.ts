import express from "express";
import { MovimientoController } from "./movimiento.controller";

export function createMovimientoRoutes(controller: MovimientoController) {
    const router = express.Router();

    router.post('/', controller.create);

    router.get('/', controller.getAll);

    router.get('/:id', controller.getOne);

    return router;
}
