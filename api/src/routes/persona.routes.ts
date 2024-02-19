import express from "express"
import PersonaController from "../controllers/persona.controller"

const router = express.Router();

router.post('/', PersonaController.create);

router.get('/', PersonaController.getAll);

router.get('/:id', PersonaController.getOne);

router.put('/:id', PersonaController.update)

router.delete('/:id', PersonaController.remove);

export default router;
