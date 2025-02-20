import express from "express"

import TransaccionController from "../controllers/transaccion.controller"
import VentaController from "../controllers/venta.controller"
import { TipoTransaccion, tipoTransaccion } from '../schemas/transaccion.schema';
import { VentaFirme, Venta } from "../models/venta.model";
import { Consignacion, Devolucion } from "../models/transaccion.model";
import { auth } from "../middleware/auth";

const transacciones = {
   [tipoTransaccion.venta]: Venta,
   [tipoTransaccion.consignacion]: Consignacion,
   [tipoTransaccion.devolucion]: Devolucion,
} as const;

const router = express.Router();

for (const tipo in transacciones){
    router.get(`/${tipo}`, auth, TransaccionController.getAll(transacciones[tipo as TipoTransaccion]));
    router.get(`/${tipo}/:id`, auth, TransaccionController.getOne(transacciones[tipo as TipoTransaccion]));

    if (tipo != tipoTransaccion.venta){
        router.post(`/${tipo}`, auth, TransaccionController.transaccion(transacciones[tipo as TipoTransaccion]));
    }
};

router.post(`/venta`, auth, VentaController.vender(VentaFirme));
router.post(`/ventaConsignacion`, auth, VentaController.ventaConsignado);

export default router;
