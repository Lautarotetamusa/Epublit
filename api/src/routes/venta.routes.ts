import express from "express"

import VentaController from "../controllers/venta.controller"
import { medioPago } from "../schemas/venta.schema";

const router = express.Router();

router.post('/', VentaController.vender);

router.get('/', VentaController.getAll);

router.get('/medios_pago', async (req, res) => {
    return res.json(Object.keys(medioPago));
});
router.get('/:id', VentaController.getOne);

export default router;
