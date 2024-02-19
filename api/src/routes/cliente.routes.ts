import express from "express";

import ClienteController from "../controllers/cliente.controller";
import ConsignacionController from "../controllers/consignacion.controller";

const router = express.Router();

router.post('/', ClienteController.create);

router.get('/', ClienteController.getAll);

router.get('/:id/stock', ClienteController.getStock);
router.get('/:id/ventas', ClienteController.getVentas);

router.post('/:id/liquidacion', ConsignacionController.liquidar);

router.get('/:id', ClienteController.getOne);
router.get('/consumidor_final', ClienteController.getOne);

router.put('/:id', ClienteController.update);

router.delete('/:id', ClienteController.delet);

export default router;
