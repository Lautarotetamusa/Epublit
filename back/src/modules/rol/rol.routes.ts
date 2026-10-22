import express from "express";
import { RolController } from "./rol.controller";

export function createRolRoutes(controller: RolController) {
    const router = express.Router();

    router.get('/', controller.getAll);

    router.post('/', controller.create);

    router.put('/:id', controller.update);

    router.delete('/:id', controller.remove);

    return router;
}
