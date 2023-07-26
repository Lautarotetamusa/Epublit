import express from "express"

import ConsignacionController from "../controllers/consignacion.controller"

const router = express.Router();

router.post('/', ConsignacionController.consignar);

router.get('/', ConsignacionController.get_all);

router.get('/:id', ConsignacionController.get_one);

router.get('/:id/remito', ConsignacionController.get_remito);

export default router;