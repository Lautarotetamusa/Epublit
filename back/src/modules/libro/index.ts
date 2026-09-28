// API pública del módulo Libro: el comportamiento (services/controllers/
// router, vía `createLibroModule`) y los tipos se importan SÓLO desde acá.
// Las tablas (`libro.schema.ts`/`libroPrecio.schema.ts`/`libroPersona.schema.ts`)
// son la excepción: otro módulo las importa directo de esos archivos, no de
// acá, por la misma razón que en el módulo Persona (evitar el ciclo de
// imports contra `createLibroService`/etc.) — ver src/modules/persona/index.ts.
import { Database } from "../../db/client";
import { Storage } from "../../lib/storage";
import { PersonaRepository } from "../persona";
import { createLibroPrecioRepository } from "./libroPrecio.repository";
import { createLibroRepository } from "./libro.repository";
import { createLibroPersonaRepository } from "./libroPersona.repository";
import { createLibroService } from "./libro.service";
import { createLibroPersonaService } from "./libroPersona.service";
import { createLibroController } from "./libro.controller";
import { createLibroPersonaController } from "./libroPersona.controller";
import { createLibroRoutes } from "./libro.routes";

export type { Libro, LibroInsert, LibroUpdate, LibroFilter, LibroCantidad } from "./libro.validator";
export type { TipoPersona, LibroPersonaBody, LibroPersonaBodyBatch, LibroPersonaRemoveBody, LibroPersonaRemoveBatch } from "./libroPersona.validator";
export type { LibroService, PublicLibro, PortadaFile } from "./libro.service";
export type { LibroPersonaService } from "./libroPersona.service";
export type { LibroRepository } from "./libro.repository";

export type LibroModuleDeps = {
    db: Database;
    personaRepository: PersonaRepository;
    storage: Storage;
};

export function createLibroModule({ db, personaRepository, storage }: LibroModuleDeps) {
    const repository = createLibroRepository({ db });
    const libroPrecioRepository = createLibroPrecioRepository({ db });
    const libroPersonaRepository = createLibroPersonaRepository({ db });

    const service = createLibroService({ db, repository, libroPrecioRepository, storage });
    const personaService = createLibroPersonaService({
        db,
        repository: libroPersonaRepository,
        libroRepository: repository,
        personaRepository
    });

    const libroController = createLibroController({ service });
    const libroPersonaController = createLibroPersonaController({ service: personaService });
    const router = createLibroRoutes(libroController, libroPersonaController);

    return { service, personaService, repository, router };
}

export type LibroModule = ReturnType<typeof createLibroModule>;
