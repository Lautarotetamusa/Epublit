// API pública del módulo Movimiento: el comportamiento (vía
// `createMovimientoModule`) y los tipos se importan SÓLO desde acá. La tabla
// (`movimiento.schema.ts`) es la excepción para otro módulo que necesite un
// join.
import { Database } from "../../db/client";
import { DepositoRepository } from "../deposito";
import { LibroRepository } from "../libro";
import { createMovimientoRepository } from "./movimiento.repository";
import { createMovimientoService } from "./movimiento.service";
import { createMovimientoController } from "./movimiento.controller";
import { createMovimientoRoutes } from "./movimiento.routes";

export type { MovimientoInsert, MovimientoPaginacion, ExtremoInput } from "./movimiento.validator";
export type { MovimientoService, PublicMovimiento, ExtremoPublico } from "./movimiento.service";
export type { MovimientoRepository, LibroEnMovimiento, MovimientoConNombres } from "./movimiento.repository";

export type MovimientoModuleDeps = {
    db: Database;
    depositoRepository: DepositoRepository;
    libroRepository: Pick<LibroRepository, "findOne">;
};

export function createMovimientoModule({ db, depositoRepository, libroRepository }: MovimientoModuleDeps) {
    const repository = createMovimientoRepository({ db });
    const service = createMovimientoService({ db, repository, depositoRepository, libroRepository });
    const controller = createMovimientoController({ service });
    const router = createMovimientoRoutes(controller);

    return { service, repository, router };
}

export type MovimientoModule = ReturnType<typeof createMovimientoModule>;
