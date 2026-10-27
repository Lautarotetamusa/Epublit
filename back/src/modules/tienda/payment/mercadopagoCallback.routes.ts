// @mount oauthCallbackRouter
import express from "express";
import { MercadoPagoController } from "./mercadopago.controller";

export function createMercadoPagoCallbackRoutes(controller: MercadoPagoController) {
    const router = express.Router();
    router.get("", controller.callback);
    return router;
}
