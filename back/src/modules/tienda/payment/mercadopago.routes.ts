// @mount adminRouter
import express from "express";
import { MercadoPagoController } from "./mercadopago.controller";

export function createMercadoPagoRoutes(controller: MercadoPagoController) {
    const router = express.Router();

    router.get("/mercadopago", controller.getStatus);
    router.get("/mercadopago/conectar", controller.connect);
    router.delete("/mercadopago", controller.disconnect);

    return router;
}
