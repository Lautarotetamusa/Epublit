// API pública del módulo Transaccion: el comportamiento (vía
// `createTransaccionModule`) y los tipos se importan SÓLO desde acá. Las tablas
// (`venta.schema.ts`) son la excepción para otro módulo que sólo necesite la
// tabla — evita el ciclo contra `createOperacionService`.
import { Database } from "../../db/client";
import { AfipService } from "../../lib/afip/Afip";
import { ComprobanteService } from "../../lib/comprobantes/comprobante";
import { Storage } from "../../lib/storage/storage";
import { LibroService } from "../libro";
import { ClienteRepository, ClienteStockService } from "../cliente";
import { DepositoRepository } from "../deposito";
import { MedioPagoService } from "../medioPago";
import { MovimientoRepository } from "../movimiento";
import { UserRepository } from "../user";
import { createVentaRepository } from "./venta.repository";
import { createOperacionConfig } from "./operacion.config";
import { createOperacionService } from "./operacion.service";
import { createTransaccionController } from "./transaccion.controller";
import { createTransaccionRoutes } from "./transaccion.routes";

export type { TipoTransaccion, CreateTransaccion } from "./transaccion.validator";
export { tiposComprobantes } from "./venta.validator";
export type { VentaRow, VentaInsert, CreateVenta, CreateVentaConsignado, ListVentasFilter, TipoVenta } from "./venta.validator";
export type { OperacionBody, LibroOperacion, ComprobanteCtx, OperacionConfig, ExtremoOperacion, MovimientoComprobante } from "./operacion.types";
export type { VentaRepository } from "./venta.repository";

export type TransaccionModuleDeps = {
    db: Database;
    libroService: LibroService;
    clienteRepository: ClienteRepository;
    clienteStockService: ClienteStockService;
    // Movimientos unificados: las operaciones comerciales crean un movimiento.
    movimientoRepository: MovimientoRepository;
    // Extremos (principal/depósito del cliente) y efecto de stock.
    depositoRepository: Pick<DepositoRepository, "findPrincipal" | "findClienteDeposito" | "moveStock">;
    userRepository: UserRepository;
    // Medio de pago de la cuenta: resuelve el medio al vender y lista los
    // activos que consume `/venta/medios_pago`.
    medioPagoService: MedioPagoService;
    afipService: AfipService;
    comprobanteService: ComprobanteService;
    storage: Storage;
};

export function createTransaccionModule({ db, libroService, clienteRepository, clienteStockService, movimientoRepository, depositoRepository, userRepository, medioPagoService, afipService, comprobanteService, storage }: TransaccionModuleDeps) {
    const ventaRepository = createVentaRepository({ db });
    const operacionConfig = createOperacionConfig({ libroService, clienteStockService, depositoRepository, afipService, comprobanteService });
    const operacionService = createOperacionService({
        db,
        userRepository,
        clienteRepository,
        movimientoRepository,
        ventaRepository,
        medioPagoService,
        depositoRepository,
        storage
    });

    const controller = createTransaccionController({ service: operacionService });
    const router = createTransaccionRoutes(controller, operacionConfig);

    return { ventaRepository, router };
}

export type TransaccionModule = ReturnType<typeof createTransaccionModule>;
