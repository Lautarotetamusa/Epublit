import express from "express";
import { Database } from "../../db/client";
import { createSessionAuth } from "../../lib/auth/auth";
import { Storage } from "../../lib/storage/storage";
import { createPublicAuth, type IntegrationService } from "../tienda";
import { createContenidoController } from "./contenido.controller";
import { handleContenidoErrors, sendContenidoError } from "./contenido.errors";
import { createContenidoRepository } from "./contenido.repository";
import { createContenidoRoutes } from "./contenido.routes";
import { createContenidoService } from "./contenido.service";
import { createContenidoPublicController } from "./contenidoPublic.controller";
import { createContenidoPublicRoutes } from "./contenidoPublic.routes";

export type ContenidoModuleDeps = {
    db: Database;
    storage: Storage;
    integrationService: Pick<
        IntegrationService,
        "authenticate" | "assertOrigin" | "originHasActiveIntegration" | "registerUsage"
    >;
};

export function createContenidoModule({ db, storage, integrationService }: ContenidoModuleDeps) {
    const repository = createContenidoRepository({ db });
    const service = createContenidoService({ db, repository, storage });
    const controller = createContenidoController({ service });
    const routes = createContenidoRoutes(controller);

    const adminRouter = express.Router();
    adminRouter.use(
        createSessionAuth({
            onMissing: (res) =>
                sendContenidoError(
                    res,
                    401,
                    "no_autenticado",
                    "Se necesita una sesión para acceder a este recurso"
                ),
            onInvalid: (res) =>
                sendContenidoError(res, 401, "no_autenticado", "La sesión no es válida")
        })
    );
    adminRouter.use(routes);
    adminRouter.use(handleContenidoErrors);

    const publicController = createContenidoPublicController({ service });
    const publicRoutes = createContenidoPublicRoutes(publicController);
    const publicRouter = express.Router();
    publicRouter.use(createPublicAuth({ service: integrationService }));
    publicRouter.use(publicRoutes);
    publicRouter.use((_req, res) =>
        sendContenidoError(res, 404, "no_encontrado", "La ruta no existe")
    );
    publicRouter.use(handleContenidoErrors);

    return { service, repository, adminRouter, publicRouter };
}

export type ContenidoModule = ReturnType<typeof createContenidoModule>;
export type { ContenidoService } from "./contenido.service";
export type { PaginaBody } from "./contenido.validator";
