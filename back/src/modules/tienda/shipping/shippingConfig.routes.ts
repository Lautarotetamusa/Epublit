// @mount adminRouter
import express from "express";
import { ShippingConfigController } from "./shippingConfig.controller";

export function createShippingConfigRoutes(controller: ShippingConfigController) {
    const router = express.Router();

    router.get("/envios", controller.get);
    router.put("/envios", controller.update);
    router.post("/envios/probar", controller.testConnection);

    return router;
}
