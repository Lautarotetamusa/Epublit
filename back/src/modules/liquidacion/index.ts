// API pública del módulo Liquidación: sólo el reporte del período (la
// previsualización). El cálculo vive en el módulo Liquidaciones (la entidad
// persistida) y se reusa desde acá; por eso este módulo no tiene repository ni
// service propios.
import { LiquidacionesService } from "../liquidaciones";
import { createLiquidacionController } from "./liquidacion.controller";
import { createLiquidacionRoutes } from "./liquidacion.routes";

export type { ReporteLiquidacion as Liquidacion } from "../liquidaciones";

export type LiquidacionModuleDeps = {
    liquidacionesService: Pick<LiquidacionesService, "reporte">;
};

export function createLiquidacionModule({ liquidacionesService }: LiquidacionModuleDeps) {
    const controller = createLiquidacionController({ service: liquidacionesService });
    const router = createLiquidacionRoutes(controller);

    return { router };
}

export type LiquidacionModule = ReturnType<typeof createLiquidacionModule>;
