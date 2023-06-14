import express from "express"

import {VentaController} from "../controllers/venta.controller.js"
import {Venta} from "../models/venta.model.js"

const router = express.Router();

router.post('/', VentaController.vender);

router.get('/', VentaController.get_all);

router.get('/:id', async (req, res) => {
    if (req.params.id == "medios_pago"){
        return res.json(Venta.str_medios_pago);
    }
    VentaController.get_one(req, res);
});

router.get('/:id/factura', VentaController.get_factura);

export default router;