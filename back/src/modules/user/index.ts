// API pública del módulo User: el comportamiento (vía `createUserModule`) y
// los tipos se importan SÓLO desde acá. `user.schema.ts`/`user.validator.ts`
// son la excepción para otros módulos que sólo necesitan la tabla o un tipo
// (ej. `lib/auth/auth.ts` con `TokenUser`, o `Afip.ts` con `User`) — evita
// el ciclo contra `createUserService`, mismo motivo que en Persona/Libro.
import { Database } from "../../db/client";
import { AfipService } from "../../lib/afip/Afip";
import { createLimiteDeEnvios } from "../../lib/limiteDeEnvios";
import { createUserRepository } from "./user.repository";
import { createTokenCuentaRepository } from "./tokenCuenta.repository";
import { createUserService, UserServiceDeps } from "./user.service";
import { createAccesoService, AccesoServiceDeps } from "./user.acceso.service";
import { ESPERA_ENTRE_ENVIOS_MS, MAXIMO_ENVIOS_EN_VENTANA, VENTANA_DE_ENVIOS_MS } from "./user.acceso";
import { generarUsernameInterno } from "./user.username";
import { createUserController } from "./user.controller";
import { createUserRoutes } from "./user.routes";

export type { User, UserInsert, UserUpdate, RegistroInput, TokenUser } from "./user.validator";
export type { UserService } from "./user.service";
export type { AccesoService } from "./user.acceso.service";
export { startLimpiezaCuentasPendientes } from "./user.limpieza";
export type { UserRepository } from "./user.repository";

export type UserModuleDeps = Pick<UserServiceDeps, "depositoRepository" | "medioPagoRepository" | "rolRepository" | "tipoEdicionRepository"> & {
    db: Database;
    afipService: AfipService;
    emailService: AccesoServiceDeps["emailService"];
    // Los tests inyectan un reloj y un generador propios (ver test/user_acceso.test.ts).
    ahora?: () => Date;
    generarUsernameInterno?: () => string;
};

export function createUserModule({
    db,
    afipService,
    emailService,
    depositoRepository,
    medioPagoRepository,
    rolRepository,
    tipoEdicionRepository,
    ahora = () => new Date(),
    generarUsernameInterno: generarUsername = generarUsernameInterno
}: UserModuleDeps) {
    const repository = createUserRepository({ db });
    const tokenRepository = createTokenCuentaRepository({ db });
    const service = createUserService({ db, repository, afipService, depositoRepository, medioPagoRepository, rolRepository, tipoEdicionRepository });
    const limitesDeEnvio = { ahora, esperaMinimaMs: ESPERA_ENTRE_ENVIOS_MS, ventanaMs: VENTANA_DE_ENVIOS_MS, maximoEnVentana: MAXIMO_ENVIOS_EN_VENTANA };
    const accesoService = createAccesoService({
        db,
        repository,
        tokenRepository,
        userService: service,
        afipService,
        emailService,
        ahora,
        generarUsernameInterno: generarUsername,
        limiteDeReenvios: createLimiteDeEnvios(limitesDeEnvio),
        limiteDeRestablecimientos: createLimiteDeEnvios(limitesDeEnvio)
    });
    const controller = createUserController({ service, accesoService });
    const router = createUserRoutes(controller);

    return { service, accesoService, repository, router };
}

export type UserModule = ReturnType<typeof createUserModule>;
