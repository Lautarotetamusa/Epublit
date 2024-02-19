import express from "express"

import LibroController from "../controllers/libro.controller"

const router = express.Router();

// Create new libro
router.post('/', LibroController.create);

router.get('/lista_libros', LibroController.listaLibros); 
router.get('', LibroController.getAll); //paginated
router.get('/:isbn', LibroController.getOne);
router.get('/:isbn/ventas', LibroController.getVentas)

router.put('/:isbn', LibroController.update);

router.delete('/:isbn', LibroController.remove);

//Personas del libro
router.post('/:isbn/personas', LibroController.managePersonas);
router.put('/:isbn/personas', LibroController.managePersonas);
router.delete('/:isbn/personas', LibroController.managePersonas);

export default router;
