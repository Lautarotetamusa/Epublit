// API pública del módulo Libro: el comportamiento (services/controllers/
// router, vía `createLibroModule`) y los tipos se importan SÓLO desde acá.
// Las tablas (`libro.schema.ts`/`libroPrecio.schema.ts`/`libroPersona.schema.ts`)
// son la excepción: otro módulo las importa directo de esos archivos, no de
// acá, por la misma razón que en el módulo Persona (evitar el ciclo de
// imports contra `createLibroService`/etc.) — ver src/modules/persona/index.ts.
import { Database } from "../../db/client";
import { Storage } from "../../lib/storage";
import { AnticipoService } from "../anticipo";
import { PersonaRepository } from "../persona";
import { ColeccionRepository } from "../coleccion";
import { DepositoRepository } from "../deposito";
import { RolRepository } from "../rol";
import { createLibroPrecioRepository } from "./libroPrecio.repository";
import { createLibroRepository } from "./libro.repository";
import { createLibroPersonaRepository } from "./libroPersona.repository";
import { createLibroService } from "./libro.service";
import { createLibroPersonaService } from "./libroPersona.service";
import { createLibroController } from "./libro.controller";
import { createLibroPersonaController } from "./libroPersona.controller";
import { createLibroRoutes } from "./libro.routes";

export type { Libro, LibroInsert, LibroUpdate, LibroFilter, LibroCantidad } from "./libro.validator";
export type { LibroPersonaBody, LibroPersonaBodyBatch, LibroPersonaRemoveBody, LibroPersonaRemoveBatch } from "./libroPersona.validator";
export type { LibroService, PublicLibro, PublicLibroConDeposito, PortadaFile } from "./libro.service";
export type { LibroPersonaService } from "./libroPersona.service";
export type { LibroRepository, LibroConColeccion } from "./libro.repository";

export type LibroModuleDeps = {
    db: Database;
    personaRepository: PersonaRepository;
    // Sólo lectura de colecciones (ownership) para validar la asignación en
    // create/update; el título lo resuelve el LEFT JOIN de libro.repository
    // (ver specs/007-colecciones, tareas 10 y 11).
    coleccionRepository: Pick<ColeccionRepository, "findOne">;
    // Sólo lectura del stock por depósito (desglose de un libro), ver
    // specs/008-movimientos-deposito. `findPropio` valida `deposito_id` en
    // listados (ver specs/018).
    depositoRepository: Pick<DepositoRepository, "getDesgloseLibro" | "findPropio">;
    // Sólo lectura de roles (ownership + vigencia) para validar la asignación
    // de personas a un libro (ver specs/011-roles).
    rolRepository: Pick<RolRepository, "findOne">;
    // Definir un monto acordado sobre un libro ya lanzado genera su anticipo
    // (ver specs/012-liquidaciones-pagos, tarea 10).
    anticipoService: Pick<AnticipoService, "generarDeLibro">;
    storage: Storage;
};

export function createLibroModule({ db, personaRepository, coleccionRepository, depositoRepository, rolRepository, anticipoService, storage }: LibroModuleDeps) {
    const repository = createLibroRepository({ db });
    const libroPrecioRepository = createLibroPrecioRepository({ db });
    const libroPersonaRepository = createLibroPersonaRepository({ db });

    const service = createLibroService({ db, repository, libroPrecioRepository, coleccionRepository, depositoRepository, storage });
    const personaService = createLibroPersonaService({
        db,
        repository: libroPersonaRepository,
        libroRepository: repository,
        personaRepository,
        rolRepository,
        anticipoService
    });

    const libroController = createLibroController({ service });
    const libroPersonaController = createLibroPersonaController({ service: personaService });
    const router = createLibroRoutes(libroController, libroPersonaController);

    return { service, personaService, repository, router };
}

export type LibroModule = ReturnType<typeof createLibroModule>;
