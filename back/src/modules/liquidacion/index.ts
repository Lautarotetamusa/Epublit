// API pública del módulo Liquidación: sólo un reporte calculado al vuelo
// (no persiste nada, no tiene tabla propia), así que no hay excepción de
// schema como en Persona/Libro/Transaccion — todo se importa desde acá.
import { Database } from "../../db/client";
import { createLiquidacionRepository } from "./liquidacion.repository";
import { createLiquidacionService } from "./liquidacion.service";
import { createLiquidacionController } from "./liquidacion.controller";
import { createLiquidacionRoutes } from "./liquidacion.routes";

export type { Liquidacion, LiquidacionService } from "./liquidacion.service";
export type { LiquidacionRepository } from "./liquidacion.repository";
export type { LiquidacionQuery } from "./liquidacion.validator";

export type LiquidacionModuleDeps = {
    db: Database;
};

export function createLiquidacionModule({ db }: LiquidacionModuleDeps) {
    const repository = createLiquidacionRepository({ db });
    const service = createLiquidacionService({ repository });
    const controller = createLiquidacionController({ service });
    const router = createLiquidacionRoutes(controller);

    return { repository, service, router };
}

export type LiquidacionModule = ReturnType<typeof createLiquidacionModule>;
