import { Database } from "../../db/client";
import type { UserRepository } from "../user";
import { createAdminAuth } from "./admin.auth";
import { createAdminRepository } from "./admin.repository";
import { createAdminService } from "./admin.service";
import { createAdminController } from "./admin.controller";
import { createAdminRoutes } from "./admin.routes";

export type { ResumenAdminService, EmbudoAdmin, SerieAdmin, ListadoAdmin, CuentaAdmin, PuntoSerie } from "./admin.service";
export type { AdminRepository } from "./admin.repository";
export type { EstadoCuenta, FiltroArca, FiltrosCuentas } from "./admin.validator";

export type AdminModuleDeps = {
    db: Database;
    userRepository: Pick<UserRepository, "findOne">;
    ahora?: () => Date;
};

export function createAdminModule({ db, userRepository, ahora }: AdminModuleDeps) {
    const repository = createAdminRepository({ db });
    const service = createAdminService({ repository, ahora });
    const controller = createAdminController({ service });
    const auth = createAdminAuth({ userRepository });
    const router = createAdminRoutes(controller, auth);

    return { service, repository, controller, router };
}

export type AdminModule = ReturnType<typeof createAdminModule>;
