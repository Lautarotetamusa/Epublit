// API pública del módulo Depósito: el comportamiento (vía
// `createDepositoModule`) y los tipos se importan SÓLO desde acá. Las tablas
// (`deposito.schema.ts`/`depositoLibros.schema.ts`) son la excepción para otro
// módulo que necesite la tabla para un join (mismo criterio que el resto).
import { Database } from "../../db/client";
import { createDepositoRepository } from "./deposito.repository";
import { createDepositoService } from "./deposito.service";
import { createDepositoController } from "./deposito.controller";
import { createDepositoRoutes } from "./deposito.routes";

export { NOMBRE_DEPOSITO_PRINCIPAL } from "./deposito.service";
export type { Deposito, DepositoInsert, DepositoUpdate } from "./deposito.validator";
export type { DepositoService, PublicDeposito } from "./deposito.service";
export type { DepositoRepository, DepositoResumen } from "./deposito.repository";

export type DepositoModuleDeps = {
    db: Database;
};

export function createDepositoModule({ db }: DepositoModuleDeps) {
    const repository = createDepositoRepository({ db });
    const service = createDepositoService({ repository });
    const controller = createDepositoController({ service });
    const router = createDepositoRoutes(controller);

    return { service, repository, router };
}

export type DepositoModule = ReturnType<typeof createDepositoModule>;
