// @mount adminRouter
import express from "express";
import multer from "multer";
import { ContenidoController } from "./contenido.controller";

export function createContenidoRoutes(controller: ContenidoController) {
    const router = express.Router();
    // En memoria, igual que portada de libro/colección. El límite de 20 MB es
    // un techo del proceso; el 413 de negocio (8 MB) lo valida el service.
    // eslint-disable-next-line sonarjs/content-length -- techo del proceso, no el límite de negocio (8 MB)
    const upload = multer({ limits: { fileSize: 20 * 1024 * 1024 } });

    router.post("/imagenes", upload.single("archivo"), controller.uploadImage);
    router.delete("/imagenes/:id", controller.deleteImage);

    router.get("/paginas", controller.listPages);
    router.get("/paginas/slug-disponible", controller.slugDisponible);
    router.post("/paginas", controller.createPage);

    router.get("/paginas/:id", controller.getPage);
    router.put("/paginas/:id", controller.updatePage);
    router.delete("/paginas/:id", controller.deletePage);
    router.post("/paginas/:id/publicar", controller.publicar);
    router.post("/paginas/:id/despublicar", controller.despublicar);

    return router;
}
