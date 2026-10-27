// @mount orderAdminRouter
import express from "express";
import { OrderAdminController } from "./orderAdmin.controller";

export function createOrderAdminRoutes(controller: OrderAdminController) {
    const router = express.Router();

    router.get("/", controller.list);
    router.get("/:codigo", controller.detail);
    router.get("/:codigo/comprobante", controller.comprobante);

    router.post("/:codigo/aceptar", controller.accept);
    router.post("/:codigo/facturar", controller.retryInvoice);
    router.post("/:codigo/rechazar", controller.reject);
    router.post("/:codigo/etiqueta", controller.generateLabel);
    router.get("/:codigo/etiqueta", controller.labelPdf);
    router.post("/:codigo/enviar", controller.ship);
    router.post("/:codigo/entregar", controller.deliver);
    router.get("/:codigo/envio", controller.shipping);
    router.post("/:codigo/envio/refrescar", controller.refreshTracking);

    return router;
}
