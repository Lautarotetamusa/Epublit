// API pública del módulo Rol: el comportamiento (vía `createRolModule`) y los
// tipos se importan SÓLO desde acá. La tabla (`rol.schema.ts`) es la excepción
// para otro módulo que necesite un join (mismo criterio que el resto).
import { Database } from "../../db/client";
import { createRolRepository } from "./rol.repository";
import { createRolService } from "./rol.service";
import { createRolController } from "./rol.controller";
import { createRolRoutes } from "./rol.routes";

export { ROLES_POR_DEFECTO } from "./rol.repository";
export type { Rol, RolRow, RolInsert, RolUpdate } from "./rol.validator";
export type { RolService } from "./rol.service";
export type { RolRepository } from "./rol.repository";

export type RolModuleDeps = {
    db: Database;
};

export function createRolModule({ db }: RolModuleDeps) {
    const repository = createRolRepository({ db });
    const service = createRolService({ repository });
    const controller = createRolController({ service });
    const router = createRolRoutes(controller);

    return { service, repository, router };
}

export type RolModule = ReturnType<typeof createRolModule>;
