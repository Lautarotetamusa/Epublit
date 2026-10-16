// API pública del módulo Anticipo: el comportamiento (vía
// `createAnticipoModule`) y los tipos se importan SÓLO desde acá. La tabla
// (`anticipo.schema.ts`) es la excepción para otro módulo que necesite un
// join (mismo criterio que el resto).
import { Database } from "../../db/client";
import { createAnticipoRepository } from "./anticipo.repository";
import { createAnticipoService } from "./anticipo.service";
import { createAnticipoController } from "./anticipo.controller";
import { createAnticipoRoutes } from "./anticipo.routes";

export type { AnticipoRow, AnticipoPagar } from "./anticipo.validator";
export type { AnticipoService, PublicAnticipo } from "./anticipo.service";
export type { AnticipoRepository, AnticipoConDatos } from "./anticipo.repository";

export type AnticipoModuleDeps = {
    db: Database;
};

export function createAnticipoModule({ db }: AnticipoModuleDeps) {
    const repository = createAnticipoRepository({ db });
    const service = createAnticipoService({ repository });
    const controller = createAnticipoController({ service });
    const router = createAnticipoRoutes(controller);

    return { service, repository, router };
}

export type AnticipoModule = ReturnType<typeof createAnticipoModule>;
