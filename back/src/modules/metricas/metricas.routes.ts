import express from "express";
import { MetricasController } from "./metricas.controller";

export function createMetricasRoutes(controller: MetricasController) {
    const router = express.Router();

    router.get('/meses', controller.getMeses);
    router.get('/resumen', controller.getResumen);
    router.get('/cortes', controller.getCortes);
    router.get('/serie', controller.getSerie);
    router.get('/medios-pago', controller.getMediosPago);

    return router;
}
