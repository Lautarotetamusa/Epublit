// API pública del módulo TipoEdición: el comportamiento (vía
// `createTipoEdicionModule`) y los tipos se importan SÓLO desde acá. La tabla
// (`tipoEdicion.schema.ts`) es la excepción para otro módulo que necesite un
// join (mismo criterio que el resto).
import { Database } from "../../db/client";
import { createTipoEdicionRepository } from "./tipoEdicion.repository";
import { createTipoEdicionService } from "./tipoEdicion.service";
import { createTipoEdicionController } from "./tipoEdicion.controller";
import { createTipoEdicionRoutes } from "./tipoEdicion.routes";

export { TIPOS_EDICION_POR_DEFECTO } from "./tipoEdicion.repository";
export type { TipoEdicion, TipoEdicionRow, TipoEdicionInsert, TipoEdicionUpdate } from "./tipoEdicion.validator";
export type { TipoEdicionService } from "./tipoEdicion.service";
export type { TipoEdicionRepository } from "./tipoEdicion.repository";

export type TipoEdicionModuleDeps = {
    db: Database;
};

export function createTipoEdicionModule({ db }: TipoEdicionModuleDeps) {
    const repository = createTipoEdicionRepository({ db });
    const service = createTipoEdicionService({ repository });
    const controller = createTipoEdicionController({ service });
    const router = createTipoEdicionRoutes(controller);

    return { service, repository, router };
}

export type TipoEdicionModule = ReturnType<typeof createTipoEdicionModule>;
