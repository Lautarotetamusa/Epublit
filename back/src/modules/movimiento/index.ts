// API pública del módulo Movimiento: el comportamiento (vía
// `createMovimientoModule`) y los tipos se importan SÓLO desde acá. La tabla
// (`movimiento.schema.ts`) es la excepción para otro módulo que necesite un
// join.
import { Database } from "../../db/client";
import { Storage } from "../../lib/storage";
import { AnticipoService } from "../anticipo";
import { DepositoRepository } from "../deposito";
import { LibroRepository } from "../libro";
import { createMovimientoRepository } from "./movimiento.repository";
import { createMovimientoService } from "./movimiento.service";
import { createMovimientoController } from "./movimiento.controller";
import { createMovimientoRoutes } from "./movimiento.routes";

export type { MovimientoInsert, ListMovimientosFilter, ExtremoInput, MovimientoTipo, ExtremoTipo } from "./movimiento.validator";
export type { MovimientoService, PublicMovimiento, ExtremoPublico } from "./movimiento.service";
export type {
    MovimientoRepository,
    LibroEnMovimiento,
    MovimientoConDetalle,
    MovimientoRow,
    VentaDeMovimiento
} from "./movimiento.repository";

export type MovimientoModuleDeps = {
    db: Database;
    depositoRepository: DepositoRepository;
    libroRepository: Pick<LibroRepository, "findOne">;
    anticipoService: Pick<AnticipoService, "generarDeLibro">;
    storage: Storage;
};

export function createMovimientoModule({ db, depositoRepository, libroRepository, anticipoService, storage }: MovimientoModuleDeps) {
    const repository = createMovimientoRepository({ db });
    const service = createMovimientoService({ db, repository, depositoRepository, libroRepository, anticipoService, storage });
    const controller = createMovimientoController({ service });
    const router = createMovimientoRoutes(controller);

    return { service, repository, router };
}

export type MovimientoModule = ReturnType<typeof createMovimientoModule>;
