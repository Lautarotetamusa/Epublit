import { db } from "./db/client";
import { env } from "./env";
import { createAfipService, AfipService } from "./lib/afip/Afip";
import { createComprobanteService, ComprobanteService } from "./lib/comprobantes/comprobante";
import { createLocalStorage } from "./lib/storage";
import { Storage } from "./lib/storage/storage";
import { createPersonaModule } from "./modules/persona";
import { createLibroModule } from "./modules/libro";
import { createUserModule } from "./modules/user";
import { createClienteModule } from "./modules/cliente";
import { createTransaccionModule } from "./modules/transaccion";
import { createLiquidacionModule } from "./modules/liquidacion";

export type CreateContainerDeps = {
    afipService?: AfipService;
    storage?: Storage;
    comprobanteService?: ComprobanteService;
};

export function createContainer({
    afipService = createAfipService({ cuitProd: env.AFIP_CUIT_PROD }),
    storage = createLocalStorage({ basePath: env.FILES_PATH, host: env.HOST }),
    comprobanteService = createComprobanteService({ storage })
}: CreateContainerDeps = {}) {
    const user = createUserModule({ db, afipService });
    const persona = createPersonaModule({ db, storage, userRepository: user.repository });
    const libro = createLibroModule({ db, personaRepository: persona.repository, storage });
    const cliente = createClienteModule({ db, afipService });
    const transaccion = createTransaccionModule({
        db,
        libroService: libro.service,
        clienteRepository: cliente.repository,
        clienteStockService: cliente.stockService,
        userRepository: user.repository,
        afipService,
        comprobanteService,
        storage
    });

    const liquidacion = createLiquidacionModule({ db });

    return { persona, libro, user, cliente, transaccion, liquidacion };
}

export type Container = ReturnType<typeof createContainer>;

export const container = createContainer();
