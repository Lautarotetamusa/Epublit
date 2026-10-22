import express from "express"
import multer from "multer";
import { PersonaController } from "./persona.controller"

// Factory: arma el router a partir de un controller ya construido, en vez
// de importar uno ya armado — mismo motivo que en persona.controller.ts.
export function createPersonaRoutes(controller: PersonaController) {
    const router = express.Router();
    // En memoria (mismo patrón que libro.routes.ts#uploadPortada): el
    // service valida tipo/tamaño/resolución y lo pasa directo a
    // `storage.write`, sin pisar filesystem temporal. El límite acá es sólo
    // un techo de protección del proceso, no el 413 de negocio.
    const upload = multer({ limits: { fileSize: 20 * 1024 * 1024 } });

    router.post('/', controller.create);

    router.get('/', controller.getAll);

    router.get('/:id', controller.getOne);

    router.put('/:id', controller.update)

    router.delete('/:id', controller.remove);

    router.post('/:id/foto', upload.single('foto'), controller.uploadFoto);

    router.delete('/:id/foto', controller.removeFoto);

    return router;
}
