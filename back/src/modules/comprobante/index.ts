// API pública del módulo Comprobante: el comportamiento (vía
// `createComprobanteModule`) y los tipos se importan SÓLO desde acá. La tabla
// (`comprobante.schema.ts`) es la excepción para otro módulo que necesite el
// schema o sus enums.
import { Database } from "../../db/client";
import { AfipService } from "../../lib/afip/Afip";
import { Storage } from "../../lib/storage/storage";
import { UserRepository } from "../user";
import { createComprobanteRepository } from "./comprobante.repository";
import { createComprobanteService } from "./comprobante.service";
import { createComprobanteController } from "./comprobante.controller";
import { createComprobanteRoutes } from "./comprobante.routes";

export type {
    ComprobanteDTO,
    ComprobanteResumen,
    ComprobanteImportesDTO,
    ComprobanteTipoDTO
} from "./comprobante.serializer";
export type {
    ComprobanteService,
    ComprobanteLinea,
    CrearFacturaInput,
    CrearRemitoInput
} from "./comprobante.service";
export type {
    ComprobanteRepository,
    ComprobanteConFactura,
    ComprobanteResumenRow,
    ComprobanteRow
} from "./comprobante.repository";

export type ComprobanteModuleDeps = {
    db: Database;
    userRepository: Pick<UserRepository, "findOne">;
    afipService: Pick<
        AfipService,
        "getClient" | "facturar" | "proximoNumero" | "consultarComprobante"
    >;
    storage: Storage;
};

export function createComprobanteModule({ db, userRepository, afipService, storage }: ComprobanteModuleDeps) {
    const repository = createComprobanteRepository({ db });
    const service = createComprobanteService({ db, repository, userRepository, afipService, storage });
    const controller = createComprobanteController({ service });
    const router = createComprobanteRoutes(controller);

    return { service, repository, router };
}

export type ComprobanteModule = ReturnType<typeof createComprobanteModule>;
