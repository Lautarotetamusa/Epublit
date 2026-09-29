// API pública del módulo Colección: el comportamiento (service/controller/
// router, vía `createColeccionModule`) y los tipos se importan SÓLO desde acá.
// La tabla (`coleccion.schema.ts`) es la excepción: el módulo Libro la usa
// para el FK de `libros.coleccion_id`, igual que el resto de los módulos.
import { Database } from "../../db/client";
import { Storage } from "../../lib/storage";
import { createColeccionRepository } from "./coleccion.repository";
import { createColeccionService } from "./coleccion.service";
import { createColeccionController } from "./coleccion.controller";
import { createColeccionRoutes } from "./coleccion.routes";

export type { Coleccion, ColeccionInsert, ColeccionUpdate } from "./coleccion.validator";
export type { ColeccionService, PublicColeccion, ColeccionLibro, PortadaColeccionFile } from "./coleccion.service";
export type { ColeccionRepository } from "./coleccion.repository";

export type ColeccionModuleDeps = {
    db: Database;
    storage: Storage;
};

export function createColeccionModule({ db, storage }: ColeccionModuleDeps) {
    const repository = createColeccionRepository({ db });
    const service = createColeccionService({ repository, storage });
    const controller = createColeccionController({ service });
    const router = createColeccionRoutes(controller);

    return { service, repository, router };
}

export type ColeccionModule = ReturnType<typeof createColeccionModule>;
