import express from "express"
import { PersonaController } from "./persona.controller"

// Factory: arma el router a partir de un controller ya construido, en vez
// de importar uno ya armado — mismo motivo que en persona.controller.ts.
export function createPersonaRoutes(controller: PersonaController) {
    const router = express.Router();

    router.post('/', controller.create);

    router.get('/', controller.getAll);

    router.get('/:id', controller.getOne);

    router.put('/:id', controller.update)

    router.delete('/:id', controller.remove);

    return router;
}
