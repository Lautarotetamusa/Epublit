import express from "express"

import TransaccionController from "../controllers/transaccion.controller"
import { operacionConfig } from "../services/operacion.config";
import { TipoTransaccion } from '../validators/transaccion.validator';
import { auth } from "../middleware/auth";

const router = express.Router();

for (const tipo in operacionConfig) {
    const config = operacionConfig[tipo as TipoTransaccion];

    router.get(`/${tipo}`, auth, TransaccionController.listarOperaciones(config));
    router.get(`/${tipo}/:id`, auth, TransaccionController.obtenerOperacion(config));
    router.post(`/${tipo}`, auth, TransaccionController.crearOperacion(config));
}

export default router;
