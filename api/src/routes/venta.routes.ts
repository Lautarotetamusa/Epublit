import express from "express"

import VentaController from "../controllers/venta.controller"
import {Venta} from "../models/venta.model"
import { medio_pago } from "../schemas/venta.schema";

const router = express.Router();

router.post('/', VentaController.vender);

router.get('/', VentaController.get_all);

router.get('/:id', VentaController.get_one);
router.get('/medios_pago', async (req, res) => {
        return res.json(medio_pago);
});

router.get('/:id/factura', VentaController.get_factura);

export default router;