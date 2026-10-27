// @mount publicRouter
import express from "express";
import { CatalogController } from "./catalog.controller";

export function createCatalogRoutes(controller: CatalogController) {
    const router = express.Router();

    router.get("/config", controller.getConfig);
    router.get("/libros", controller.getBooks);
    router.get("/libros/:isbn", controller.getBook);

    return router;
}
