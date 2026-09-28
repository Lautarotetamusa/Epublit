// API pública del módulo Transaccion: el comportamiento (vía
// `createTransaccionModule`) y los tipos se importan SÓLO desde acá. Las
// tablas (`transaccion.schema.ts`/`venta.schema.ts`/`librosTransacciones.schema.ts`)
// son la excepción para otro módulo que sólo necesite la tabla — evita el
// ciclo contra `createTransaccionService`, mismo motivo que en Persona/Libro/Cliente.
import { Database } from "../../db/client";
import { AfipService } from "../../lib/afip/Afip";
import { ComprobanteService } from "../../lib/comprobantes/comprobante";
import { Storage } from "../../lib/storage/storage";
import { LibroService } from "../libro";
import { ClienteRepository, ClienteStockService } from "../cliente";
import { UserRepository } from "../user";
import { createTransaccionRepository } from "./transaccion.repository";
import { createVentaRepository } from "./venta.repository";
import { createOperacionConfig } from "./operacion.config";
import { createOperacionService } from "./operacion.service";
import { createTransaccionController } from "./transaccion.controller";
import { createTransaccionRoutes } from "./transaccion.routes";

export type { TipoTransaccion, TransaccionRow, TransaccionInsert, CreateTransaccion } from "./transaccion.validator";
export { medioPago, tiposComprobantes } from "./venta.validator";
export type { VentaRow, VentaInsert, CreateVenta, CreateVentaConsignado, MedioPago, ListVentasFilter, TipoVenta } from "./venta.validator";
export type { OperacionBody, LibroOperacion, TransaccionConCliente, ComprobanteCtx, OperacionConfig } from "./operacion.types";
export type { TransaccionRepository } from "./transaccion.repository";
export type { VentaRepository } from "./venta.repository";

export type TransaccionModuleDeps = {
    db: Database;
    libroService: LibroService;
    clienteRepository: ClienteRepository;
    clienteStockService: ClienteStockService;
    userRepository: UserRepository;
    afipService: AfipService;
    comprobanteService: ComprobanteService;
    storage: Storage;
};

export function createTransaccionModule({ db, libroService, clienteRepository, clienteStockService, userRepository, afipService, comprobanteService, storage }: TransaccionModuleDeps) {
    const repository = createTransaccionRepository({ db });
    const ventaRepository = createVentaRepository({ db });
    const operacionConfig = createOperacionConfig({ libroService, clienteStockService, afipService, comprobanteService });
    const operacionService = createOperacionService({
        db,
        userRepository,
        clienteRepository,
        transaccionRepository: repository,
        ventaRepository,
        storage
    });

    const controller = createTransaccionController({ service: operacionService });
    const router = createTransaccionRoutes(controller, operacionConfig);

    return { repository, ventaRepository, router };
}

export type TransaccionModule = ReturnType<typeof createTransaccionModule>;
