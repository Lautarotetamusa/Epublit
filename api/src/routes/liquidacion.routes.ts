import express from "express";

import LiquidacionController from "../controllers/liquidacion.controller";

const router = express.Router();

router.post('/', LiquidacionController.create);

router.get('/:id', LiquidacionController.getOne);

router.get('/', LiquidacionController.getAll);

export default router;
