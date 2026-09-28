import express from "express"
import multer from "multer";
import { LibroController } from "./libro.controller";
import { LibroPersonaController } from "./libroPersona.controller";

export function createLibroRoutes(libroController: LibroController, libroPersonaController: LibroPersonaController) {
    const router = express.Router();
    // En memoria (mismo patrón que user.routes.ts#uploadCert): el service
    // valida tipo/tamaño exacto (413 si pasa los 5MB del plan) y lo pasa
    // directo a `storage.write`, sin pisar filesystem temporal. El límite
    // acá es sólo un techo de protección del proceso (no el 413 de negocio).
    const upload = multer({ limits: { fileSize: 20 * 1024 * 1024 } });

    // Create new libro: `service.create` maneja su propia transacción Postgres.
    router.post('/', libroController.create);

    router.get('/lista_libros', libroController.listaLibros);

    router.get('', libroController.getAll);

    router.get('/:isbn', libroController.getOne);

    router.get('/:isbn/precio', libroController.getPrecios)

    router.put('/:isbn', libroController.update);

    router.delete('/:isbn', libroController.remove);

    router.post('/:isbn/portada', upload.single('portada'), libroController.uploadPortada);

    router.post('/:isbn/personas', libroPersonaController.addLibroPersonas);
    router.put('/:isbn/personas', libroPersonaController.updateLibroPersonas);
    router.delete('/:isbn/personas', libroPersonaController.deleteLibroPersonas);

    return router;
}
