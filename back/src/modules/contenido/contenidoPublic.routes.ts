// @mount publicRouter
import express from "express";
import { ContenidoPublicController } from "./contenidoPublic.controller";

export function createContenidoPublicRoutes(controller: ContenidoPublicController) {
    const router = express.Router();

    router.get("/paginas", controller.listPages);
    router.get("/paginas/:slug", controller.getPage);
    router.get("/menu", controller.getMenu);

    return router;
}
