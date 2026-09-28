import express from "express";
import { ClienteController } from "./cliente.controller";

export function createClienteRoutes(controller: ClienteController) {
    const router = express.Router();

    router.post('/', controller.create);

    router.get('/', controller.getAll);

    router.get('/:id/stock', controller.getStock);
    router.put('/:id/stock', controller.updatePrecios);

    router.get('/:id/ventas', controller.getVentas);

    router.get('/:id', controller.getOne);

    router.put('/:id', controller.update);

    router.delete('/:id', controller.remove);

    return router;
}
