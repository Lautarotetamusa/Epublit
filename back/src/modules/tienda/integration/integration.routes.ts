// @mount router
import express from "express";
import { IntegrationController } from "./integration.controller";

export function createIntegrationRoutes(controller: IntegrationController) {
    const router = express.Router();

    router.get("/", controller.getAll);
    router.post("/", controller.create);
    router.patch("/:id", controller.update);
    router.delete("/:id", controller.revoke);

    return router;
}
