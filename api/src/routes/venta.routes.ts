import express from "express"
import VentaController from "../controllers/venta.controller"

const router = express.Router();

router.post('/', VentaController.vender);

export default router;
