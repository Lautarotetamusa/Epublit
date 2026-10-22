// API pública del módulo MedioPago: el comportamiento (vía
// `createMedioPagoModule`) y los tipos se importan SÓLO desde acá. La tabla
// (`medioPago.schema.ts`) es la excepción para otro módulo que necesite un
// join (mismo criterio que el resto).
import { Database } from "../../db/client";
import { createMedioPagoRepository } from "./medioPago.repository";
import { createMedioPagoService } from "./medioPago.service";
import { createMedioPagoController } from "./medioPago.controller";
import { createMedioPagoRoutes } from "./medioPago.routes";

export { MEDIOS_PAGO_POR_DEFECTO } from "./medioPago.repository";
export type { MedioPago, MedioPagoRow, MedioPagoInsert, MedioPagoUpdate } from "./medioPago.validator";
export type { MedioPagoService } from "./medioPago.service";
export type { MedioPagoRepository } from "./medioPago.repository";

export type MedioPagoModuleDeps = {
    db: Database;
};

export function createMedioPagoModule({ db }: MedioPagoModuleDeps) {
    const repository = createMedioPagoRepository({ db });
    const service = createMedioPagoService({ repository });
    const controller = createMedioPagoController({ service });
    const router = createMedioPagoRoutes(controller);

    return { service, repository, router };
}

export type MedioPagoModule = ReturnType<typeof createMedioPagoModule>;
