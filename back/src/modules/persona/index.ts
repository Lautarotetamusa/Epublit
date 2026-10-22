import { Database } from "../../db/client";
import { Storage } from "../../lib/storage";
import { UserRepository } from "../user";
import { RolRepository } from "../rol";
import { createPersonaRepository } from "./persona.repository";
import { createPersonaService } from "./persona.service";
import { createPersonaController } from "./persona.controller";
import { createPersonaRoutes } from "./persona.routes";

export type { Persona, PersonaInsert, PersonaUpdate } from "./persona.validator";
export type { PersonaService, PublicPersona, FotoFile } from "./persona.service";
export type { PersonaRepository } from "./persona.repository";

export type PersonaModuleDeps = {
    db: Database;
    storage: Storage;
    userRepository: Pick<UserRepository, "findOne">;
    // Sólo lectura: valida el filtro del listado por rol de la cuenta.
    rolRepository: Pick<RolRepository, "existsEnCuenta">;
};

export function createPersonaModule({ db, storage, userRepository, rolRepository }: PersonaModuleDeps) {
    const repository = createPersonaRepository({ db });
    const service = createPersonaService({ repository, storage, userRepository, rolRepository });
    const controller = createPersonaController({ service });
    const router = createPersonaRoutes(controller);

    return { service, repository, router };
}

export type PersonaModule = ReturnType<typeof createPersonaModule>;
