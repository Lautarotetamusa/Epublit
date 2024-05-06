import express from "express"

import ConsignacionController from "../controllers/consignacion.controller"
import { tipoTransaccion } from "../schemas/transaccion.schema";

const router = express.Router();

router.post('/', ConsignacionController.consignar);

router.post('/venta', ConsignacionController.transaccion(tipoTransaccion.ventaConsignacion));
router.post('/devolucion', ConsignacionController.transaccion(tipoTransaccion.devolucion));

export default router;
