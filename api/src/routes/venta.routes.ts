import express from "express"

import VentaController from "../controllers/venta.controller"
import { medio_pago } from "../schemas/venta.schema";

const router = express.Router();

router.post('/', VentaController.vender);

router.get('/', VentaController.get_all);

router.get('/medios_pago', async (req, res) => {
        return res.json(Object.values(medio_pago).filter(m => isNaN(Number(m))));
});
router.get('/:id', VentaController.get_one);

router.get('/:id/factura', VentaController.get_factura);

export default router;