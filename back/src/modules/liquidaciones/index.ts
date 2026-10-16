// API pública del módulo Liquidaciones: la liquidación persistida (período,
// código, líneas por persona, ventas cubiertas) y sus pagos. El comportamiento
// (vía `createLiquidacionesModule`) y los tipos se importan SÓLO desde acá. La
// tabla (`liquidaciones.schema.ts`) es la excepción para otro módulo que
// necesite un join (mismo criterio que el resto).
import { Database } from "../../db/client";
import { createLiquidacionesRepository } from "./liquidaciones.repository";
import { createLiquidacionesService } from "./liquidaciones.service";
import { createLiquidacionesController } from "./liquidaciones.controller";
import { createLiquidacionesRoutes } from "./liquidaciones.routes";

export { liquidacionesValidator } from "./liquidaciones.validator";
export type {
    LiquidacionRango,
    LiquidacionPagoBody
} from "./liquidaciones.validator";
export type {
    LiquidacionesService,
    ReporteLiquidacion,
    FichaLiquidacion,
    LiquidacionListado,
    PersonaFicha,
    PersonaLiquidacion,
    DetalleLiquidacion,
    LibroLiquidacion,
    Excluida,
    EstadoLiquidacion
} from "./liquidaciones.service";
export type { LiquidacionesRepository } from "./liquidaciones.repository";

export type LiquidacionesModuleDeps = {
    db: Database;
};

export function createLiquidacionesModule({ db }: LiquidacionesModuleDeps) {
    const repository = createLiquidacionesRepository({ db });
    const service = createLiquidacionesService({ db, repository });
    const controller = createLiquidacionesController({ service });
    const router = createLiquidacionesRoutes(controller);

    return { service, repository, router };
}

export type LiquidacionesModule = ReturnType<typeof createLiquidacionesModule>;
