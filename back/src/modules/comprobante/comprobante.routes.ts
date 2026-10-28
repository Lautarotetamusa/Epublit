import express from "express";
import { ComprobanteController } from "./comprobante.controller";

export function createComprobanteRoutes(controller: ComprobanteController) {
    const router = express.Router();

    router.get("/:id", controller.getOne);
    router.post("/:id/reintentar", controller.reintentar);

    return router;
}
