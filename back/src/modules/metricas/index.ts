// API pública del módulo Métricas: el panel de ventas de sólo lectura. El
// comportamiento (vía `createMetricasModule`) y los tipos se importan SÓLO
// desde acá.
import { Database } from "../../db/client";
import { createMetricasRepository } from "./metricas.repository";
import { createMetricasService } from "./metricas.service";
import { createMetricasController } from "./metricas.controller";
import { createMetricasRoutes } from "./metricas.routes";

export type { AlcanceMetricas } from "./metricas.validator";
export type {
    ResumenMetricas,
    CortesMetricas,
    SerieMetricas,
    MediosPagoMetricas,
    FilaTitulo,
    FilaCliente,
    FilaDeposito,
    CifraComparada
} from "./metricas.service";
export type { MetricasRepository } from "./metricas.repository";

export type MetricasModuleDeps = {
    db: Database;
};

export function createMetricasModule({ db }: MetricasModuleDeps) {
    const repository = createMetricasRepository({ db });
    const service = createMetricasService({ repository });
    const controller = createMetricasController({ service });
    const router = createMetricasRoutes(controller);

    return { service, repository, router };
}

export type MetricasModule = ReturnType<typeof createMetricasModule>;
