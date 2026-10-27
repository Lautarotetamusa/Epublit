// @mount publicRouter
import express from "express";
import { WebhookController } from "./webhook.controller";

export function createWebhookRoutes(controller: WebhookController) {
    const router = express.Router();
    router.post("/webhooks/mercadopago", controller.mercadopago);
    return router;
}
