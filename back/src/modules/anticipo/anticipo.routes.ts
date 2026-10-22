import express from "express";
import { AnticipoController } from "./anticipo.controller";

export function createAnticipoRoutes(controller: AnticipoController) {
    const router = express.Router();

    router.get('/', controller.getAll);

    router.post('/:id/pagar', controller.pagar);

    return router;
}
