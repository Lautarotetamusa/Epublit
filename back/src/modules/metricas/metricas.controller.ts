import { RequestHandler } from "express";
import { ok } from "../../lib/http/responses";
import { metricasValidator } from "./metricas.validator";
import { MetricasService } from "./metricas.service";

// Adapter HTTP puro: parsea la query con zod, llama al service y responde con
// el sobre estándar. La resolución del período y las agregaciones viven en
// metricas.service.ts.
export type MetricasControllerDeps = {
    service: MetricasService;
};

export function createMetricasController({ service }: MetricasControllerDeps) {
    const getMeses: RequestHandler = async (_, res) => {
        ok(res, await service.meses(res.locals.user.id));
    };

    const getResumen: RequestHandler = async (req, res) => {
        const { mes, alcance } = metricasValidator.consulta.parse(req.query);

        ok(res, await service.resumen(res.locals.user.id, mes, alcance));
    };

    const getCortes: RequestHandler = async (req, res) => {
        const { mes, alcance } = metricasValidator.consulta.parse(req.query);

        ok(res, await service.cortes(res.locals.user.id, mes, alcance));
    };

    const getSerie: RequestHandler = async (req, res) => {
        const { mes, alcance } = metricasValidator.consulta.parse(req.query);

        ok(res, await service.serie(res.locals.user.id, mes, alcance));
    };

    const getMediosPago: RequestHandler = async (req, res) => {
        const { mes, alcance } = metricasValidator.consulta.parse(req.query);

        ok(res, await service.mediosPago(res.locals.user.id, mes, alcance));
    };

    return { getMeses, getResumen, getCortes, getSerie, getMediosPago };
}

export type MetricasController = ReturnType<typeof createMetricasController>;
