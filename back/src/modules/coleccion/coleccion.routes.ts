import express from "express";
import multer from "multer";
import { ColeccionController } from "./coleccion.controller";

export function createColeccionRoutes(controller: ColeccionController) {
    const router = express.Router();
    // En memoria (mismo patrón que libro.routes.ts/persona.routes.ts): el
    // service valida tipo/tamaño exacto (413 si pasa los 5 MB del plan) y lo
    // pasa directo a `storage.write`, sin pisar filesystem temporal. El límite
    // acá es sólo un techo de protección del proceso, no el 413 de negocio.
    // eslint-disable-next-line sonarjs/content-length -- techo del proceso, no el límite de negocio (5 MB, validado en el service)
    const upload = multer({ limits: { fileSize: 20 * 1024 * 1024 } });

    router.post('/', controller.create);

    router.get('/', controller.getAll);

    router.get('/:id', controller.getOne);

    router.put('/:id', controller.update);

    router.delete('/:id', controller.remove);

    router.get('/:id/libros', controller.getLibros);

    router.post('/:id/portada', upload.single('portada'), controller.uploadPortada);

    router.delete('/:id/portada', controller.removePortada);

    return router;
}
