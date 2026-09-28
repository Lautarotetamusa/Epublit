import express from "express"
import { auth } from "../../lib/auth/auth";
import { TransaccionController } from "./transaccion.controller";
import { OperacionConfig } from "./operacion.types";
import { TipoTransaccion } from "./transaccion.validator";

export function createTransaccionRoutes(controller: TransaccionController, operacionConfig: Record<TipoTransaccion, OperacionConfig>) {
    const router = express.Router();

    for (const tipo in operacionConfig) {
        const config = operacionConfig[tipo as TipoTransaccion];

        router.get(`/${tipo}`, auth, controller.listarOperaciones(config));
        router.get(`/${tipo}/:id`, auth, controller.obtenerOperacion(config));
        router.post(`/${tipo}`, auth, controller.crearOperacion(config));
    }

    return router;
}
