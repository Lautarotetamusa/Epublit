import express from "express"

import {PersonaController} from "../controllers/persona.controller.js"
//import {Persona} from "../models/persona.model.js"

const router = express.Router();

router.post('/', PersonaController.create);

router.get('/', PersonaController.get_all);

router.get('/:id', PersonaController.get_one);

router.put('/:id', PersonaController.update)

router.delete('/:id', PersonaController.delete);

/*router.get('/tipos', (req, res) => {
    return res.json(Persona.tipos);
})*/

export default router;