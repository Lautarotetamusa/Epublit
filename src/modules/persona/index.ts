import { Database } from "../../db/client";
import { createPersonaRepository } from "./persona.repository";
import { createPersonaService } from "./persona.service";
import { createPersonaController } from "./persona.controller";
import { createPersonaRoutes } from "./persona.routes";

export type { Persona, PersonaInsert, PersonaUpdate } from "./persona.validator";
export type { PersonaService } from "./persona.service";
export type { PersonaRepository } from "./persona.repository";

export type PersonaModuleDeps = {
    db: Database;
};

export function createPersonaModule({ db }: PersonaModuleDeps) {
    const repository = createPersonaRepository({ db });
    const service = createPersonaService({ repository });
    const controller = createPersonaController({ service });
    const router = createPersonaRoutes(controller);

    return { service, repository, router };
}

export type PersonaModule = ReturnType<typeof createPersonaModule>;
