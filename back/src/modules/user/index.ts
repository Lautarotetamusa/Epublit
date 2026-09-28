// API pública del módulo User: el comportamiento (vía `createUserModule`) y
// los tipos se importan SÓLO desde acá. `user.schema.ts`/`user.validator.ts`
// son la excepción para otros módulos que sólo necesitan la tabla o un tipo
// (ej. `lib/auth/auth.ts` con `TokenUser`, o `Afip.ts` con `User`) — evita
// el ciclo contra `createUserService`, mismo motivo que en Persona/Libro.
import { Database } from "../../db/client";
import { AfipService } from "../../lib/afip/Afip";
import { createUserRepository } from "./user.repository";
import { createUserService } from "./user.service";
import { createUserController } from "./user.controller";
import { createUserRoutes } from "./user.routes";

export type { User, UserInsert, UserUpdate, CreateUserInput, TokenUser } from "./user.validator";
export type { UserService } from "./user.service";
export type { UserRepository } from "./user.repository";

export type UserModuleDeps = {
    db: Database;
    afipService: AfipService;
};

export function createUserModule({ db, afipService }: UserModuleDeps) {
    const repository = createUserRepository({ db });
    const service = createUserService({ db, repository, afipService });
    const controller = createUserController({ service });
    const router = createUserRoutes(controller);

    return { service, repository, router };
}

export type UserModule = ReturnType<typeof createUserModule>;
