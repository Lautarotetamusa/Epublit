import express from "express";

import LiquidacionController from "../controllers/liquidacion.controller";

const router = express.Router();

router.post('/', LiquidacionController.create);

router.get('/:id', LiquidacionController.get_one);

router.get('/', LiquidacionController.get_all);

export default router;
