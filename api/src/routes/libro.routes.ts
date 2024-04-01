import express from "express"

import LibroController from "../controllers/libro.controller"
import LibroPersonaController from "../controllers/libro_persona.controller"

const router = express.Router();

// Create new libro
router.post('/', LibroController.create);

router.get('/lista_libros', LibroController.listaLibros); 

router.get('', LibroController.getAll); //paginated

router.get('/:isbn', LibroController.getOne);

router.get('/:isbn/ventas', LibroController.getVentas)

router.get('/:isbn/precio', LibroController.getPrecios)

router.put('/:isbn', LibroController.update);

router.delete('/:isbn', LibroController.remove);

router.post('/:isbn/personas', LibroPersonaController.addLibroPersonas);
router.put('/:isbn/personas', LibroPersonaController.updateLibroPersonas);
router.delete('/:isbn/personas', LibroPersonaController.deleteLibroPersonas);

export default router;
