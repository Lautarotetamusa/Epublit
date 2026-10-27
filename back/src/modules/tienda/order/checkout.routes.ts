// @mount publicRouter
import express from "express";
import { CheckoutController } from "./checkout.controller";

export function createCheckoutRoutes(controller: CheckoutController) {
    const router = express.Router();

    router.post("/cotizar", controller.quoteCart);
    router.post("/pedidos", controller.create);
    router.get("/pedidos/:codigo", controller.get);
    router.post("/pedidos/:codigo/pago", controller.payment);
    router.post("/pedidos/:codigo/cancelar", controller.cancel);

    return router;
}
