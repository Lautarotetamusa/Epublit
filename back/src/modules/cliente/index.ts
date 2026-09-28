// API pública del módulo Cliente: el comportamiento (vía `createClienteModule`)
// y los tipos se importan SÓLO desde acá. Las tablas
// (`cliente.schema.ts`/`libroCliente.schema.ts`/`precioLibroCliente.schema.ts`)
// son la excepción para otros módulos que sólo necesitan la tabla — evita el
// ciclo contra `createClienteService`, mismo motivo que en Persona/Libro.
import { Database } from "../../db/client";
import { AfipService } from "../../lib/afip/Afip";
import { createClienteRepository } from "./cliente.repository";
import { createClienteStockRepository } from "./clienteStock.repository";
import { createClienteService } from "./cliente.service";
import { createClienteStockService } from "./clienteStock.service";
import { createClienteController } from "./cliente.controller";
import { createClienteRoutes } from "./cliente.routes";

export { tipoCliente } from "./cliente.validator";
export { generateClientPath } from "./cliente.service";
export type { Client, ClienteInsert, ClienteUpdate, TipoCliente } from "./cliente.validator";
export type { ClienteService } from "./cliente.service";
export type { ClienteStockService } from "./clienteStock.service";
export type { ClienteRepository } from "./cliente.repository";

export type ClienteModuleDeps = {
    db: Database;
    afipService: AfipService;
};

export function createClienteModule({ db, afipService }: ClienteModuleDeps) {
    const repository = createClienteRepository({ db });
    const stockRepository = createClienteStockRepository({ db });

    const service = createClienteService({ repository, afipService });
    const stockService = createClienteStockService({ db, repository: stockRepository, clienteRepository: repository });

    const controller = createClienteController({ service, stockService });
    const router = createClienteRoutes(controller);

    return { service, stockService, repository, router };
}

export type ClienteModule = ReturnType<typeof createClienteModule>;
