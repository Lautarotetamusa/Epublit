import express from "express";
import { DepositoController } from "./deposito.controller";

export function createDepositoRoutes(controller: DepositoController) {
    const router = express.Router();

    router.post('/', controller.create);

    router.get('/', controller.getAll);

    router.get('/:id', controller.getOne);

    router.put('/:id', controller.update);

    router.delete('/:id', controller.remove);

    router.get('/:id/libros', controller.getLibros);

    return router;
}
