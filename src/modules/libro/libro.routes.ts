import express from "express"
import { LibroController } from "./libro.controller";
import { LibroPersonaController } from "./libroPersona.controller";

export function createLibroRoutes(libroController: LibroController, libroPersonaController: LibroPersonaController) {
    const router = express.Router();

    // Create new libro: `service.create` maneja su propia transacción Postgres.
    router.post('/', libroController.create);

    router.get('/lista_libros', libroController.listaLibros);

    router.get('', libroController.getAll);

    router.get('/:isbn', libroController.getOne);

    router.get('/:isbn/precio', libroController.getPrecios)

    router.put('/:isbn', libroController.update);

    router.delete('/:isbn', libroController.remove);

    router.post('/:isbn/personas', libroPersonaController.addLibroPersonas);
    router.put('/:isbn/personas', libroPersonaController.updateLibroPersonas);
    router.delete('/:isbn/personas', libroPersonaController.deleteLibroPersonas);

    return router;
}
