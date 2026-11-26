import express from "express";
import { TipoEdicionController } from "./tipoEdicion.controller";

export function createTipoEdicionRoutes(controller: TipoEdicionController) {
    const router = express.Router();

    router.get('/', controller.getAll);

    router.post('/', controller.create);

    router.put('/:id', controller.update);

    router.delete('/:id', controller.remove);

    return router;
}
