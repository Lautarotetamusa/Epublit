import { db } from "./db/client";
import { env } from "./env";
import { createAfipService, AfipService } from "./lib/afip/Afip";
import { createPersonaModule } from "./modules/persona";
import { createLibroModule } from "./modules/libro";
import { createUserModule } from "./modules/user";
import { createClienteModule } from "./modules/cliente";
import { createTransaccionModule } from "./modules/transaccion";

export type CreateContainerDeps = {
    afipService?: AfipService;
};

// Composition root: el único lugar donde se arman los módulos y se les
// inyecta `db` (y, para los que dependen de otros módulos, el service ya
// armado de ese módulo — nunca el container completo, para no crear un
// ciclo container.ts ↔ modules/*). `afipService` es opcional: por default
// arma el real, pero los tests pueden pasar `createMockAfipService()` (ver
// `lib/afip/Afip.mock.ts`) para no depender de `vi.mock` ni de red/filesystem
// real de AFIP.
export function createContainer({ afipService = createAfipService({ cuitProd: env.AFIP_CUIT_PROD }) }: CreateContainerDeps = {}) {
    const persona = createPersonaModule({ db });
    const libro = createLibroModule({ db, personaRepository: persona.repository });
    const user = createUserModule({ db, afipService });
    const cliente = createClienteModule({ db, afipService });
    const transaccion = createTransaccionModule({
        db,
        libroService: libro.service,
        clienteRepository: cliente.repository,
        clienteStockService: cliente.stockService,
        userRepository: user.repository,
        afipService
    });

    return { persona, libro, user, cliente, transaccion };
}

export type Container = ReturnType<typeof createContainer>;

export const container = createContainer();
