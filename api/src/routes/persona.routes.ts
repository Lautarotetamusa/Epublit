import express from "express"

import PersonaController from "../controllers/persona.controller"

const router = express.Router();

router.post('/', PersonaController.create);

router.get('/', PersonaController.get_all);

router.get('/:id', PersonaController.get_one);

router.put('/:id', PersonaController.update)

router.delete('/:id', PersonaController.remove);

export default router;