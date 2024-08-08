import express from "express";

import ClienteController from "../controllers/cliente.controller";

const router = express.Router();

router.post('/', ClienteController.create);

router.get('/', ClienteController.getAll);

router.get('/:id/stock', ClienteController.getStock);
router.put('/:id/stock', ClienteController.updatePrecios);

router.get('/:id/ventas', ClienteController.getVentas);

router.get('/:id', ClienteController.getOne);
router.get('/consumidor_final', ClienteController.getOne);

router.put('/:id', ClienteController.update);

router.delete('/:id', ClienteController.delet);

export default router;
