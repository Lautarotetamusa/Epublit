import express from "express"

import {ConsignacionController} from "../controllers/consignacion.controller"

const router = express.Router();

router.post('/', ConsignacionController.consignar);
export default router;