import express from "express"

import LibroController from "../controllers/libro.controller"

const router = express.Router();

// Create new libro
router.post('/', LibroController.create);

router.get('/lista_libros', LibroController.lista_libros); 
router.get('', LibroController.get_all); //paginated
router.get('/:isbn', LibroController.get_one);
router.get('/:isbn/ventas', LibroController.get_ventas)

router.put('/:isbn', LibroController.update);

router.delete('/:isbn', LibroController.remove);

//Personas del libro
router.post('/:isbn/personas', LibroController.manage_personas);
router.put('/:isbn/personas', LibroController.manage_personas);
router.delete('/:isbn/personas', LibroController.manage_personas);

export default router;