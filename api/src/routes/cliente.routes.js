import express from "express"

import {ClienteController} from "../controllers/cliente.controller.js"
import {ConsignacionController} from "../controllers/consignacion.controller.js"

const router = express.Router();

router.post('/', ClienteController.create);

router.get('/', ClienteController.get_all);

router.get('/:id/stock', ClienteController.get_stock);
router.get('/:id/ventas', ClienteController.get_ventas);

router.post('/:id/liquidacion', ConsignacionController.liquidar);

router.get('/:id', ClienteController.get_one);

router.put('/:id', ClienteController.update)

router.delete('/:id', ClienteController.delet)

export default router;