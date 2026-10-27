import { sql } from "drizzle-orm";
import type { Database } from "../../../db/client";
import type { AfipService } from "../../../lib/afip/Afip";
import type { ComprobanteService } from "../../../lib/comprobantes/comprobante";
import type { ClienteRepository } from "../../cliente";
import type { MedioPagoService } from "../../medioPago";
import type { MovimientoRepository } from "../../movimiento";
import type { UserRepository } from "../../user";
import type { VentaRepository } from "../../transaccion/venta.repository";
import type { OrderRepository } from "./order.repository";
import { OrderAdminError } from "./orderAdmin.errors";

export type InvoiceServiceDeps = {
    db: Database;
    orderRepository: OrderRepository;
    ventaRepository: Pick<VentaRepository, "findRowByIdMovimiento">;
    movimientoRepository: Pick<MovimientoRepository, "getById">;
    clienteRepository: Pick<ClienteRepository, "findOne">;
    medioPagoService: Pick<MedioPagoService, "findActivo">;
    userRepository: Pick<UserRepository, "findOne">;
    afipService: Pick<AfipService, "getClient" | "facturar">;
    comprobanteService: Pick<ComprobanteService, "emitirComprobante">;
};

export type InvoiceResult = {
    ok: boolean;
    error?: string;
};

const parseAfipDate = (value: string): Date => {
    const date = new Date(`${value}T00:00:00.000-03:00`);
    return Number.isNaN(date.getTime()) ? new Date() : date;
};

// Emisión de la Factura B de un pedido ya aceptado. Se ejecuta después del
// commit de la venta: un fallo de AFIP o del render nunca revierte la venta,
// sólo deja el comprobante pendiente para reintentar.
export function createInvoiceService({
    db,
    orderRepository,
    ventaRepository,
    movimientoRepository,
    clienteRepository,
    medioPagoService,
    userRepository,
    afipService,
    comprobanteService
}: InvoiceServiceDeps) {
    const emit = async (userId: number, codigo: string): Promise<InvoiceResult> =>
        db.transaction(async (tx) => {
            // Serializa dos reintentos simultáneos: el segundo ve el
            // comprobante ya emitido y no vuelve a facturar.
            const lock = `factura:${userId}:${codigo}`;
            await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lock}))`);

            const pedido = await orderRepository.findByCode(userId, codigo, tx, true);

            if (pedido.comprobante_estado === "emitido") return { ok: true };
            if (!["aceptado", "enviado", "entregado"].includes(pedido.estado)) {
                throw new OrderAdminError(
                    409,
                    "transicion_invalida",
                    "Sólo se factura un pedido aceptado"
                );
            }
            if (pedido.venta_id === null) {
                throw new OrderAdminError(
                    409,
                    "transicion_invalida",
                    "El pedido todavía no tiene una venta generada"
                );
            }

            try {
                const [venta, movimiento, user] = await Promise.all([
                    ventaRepository.findRowByIdMovimiento(pedido.venta_id, userId),
                    movimientoRepository.getById(pedido.venta_id, userId),
                    userRepository.findOne({ id: userId })
                ]);

                if (!venta) throw new Error("El pedido no tiene una venta asociada");
                if (user.punto_venta === null || user.punto_venta === undefined) {
                    throw new Error("La cuenta no tiene punto de venta configurado");
                }

                const [cliente, medioPago] = await Promise.all([
                    clienteRepository.findOne({ id: venta.id_cliente, user: userId }),
                    medioPagoService.findActivo(venta.id_medio_pago, userId)
                ]);

                const afip = afipService.getClient(user);
                const comprobante = await afipService.facturar(
                    user.punto_venta,
                    venta,
                    cliente,
                    afip
                );

                const items = await orderRepository.getItems(pedido.id, userId, tx);
                const libros = items.map((item) => ({
                    id_libro: 0,
                    isbn: item.isbn,
                    titulo: item.titulo,
                    cantidad: item.cantidad,
                    precio: item.precio_unitario,
                    stock: 0
                }));

                await comprobanteService.emitirComprobante({
                    data: {
                        venta,
                        medioPago,
                        transaction: {
                            id: movimiento.id,
                            file_path: movimiento.file_path ?? ""
                        },
                        libros,
                        cliente,
                        comprobante
                    },
                    user
                });

                await orderRepository.updateOrder(
                    userId,
                    pedido.id,
                    {
                        comprobante_tipo: String(venta.tipo_cbte),
                        comprobante_numero: String(comprobante.nro),
                        comprobante_fecha: parseAfipDate(comprobante.CbteFch),
                        comprobante_file_path: movimiento.file_path,
                        comprobante_estado: "emitido"
                    },
                    tx
                );
                await orderRepository.insertHistory(
                    pedido.id,
                    userId,
                    "comprobante_emitido",
                    `Factura B ${comprobante.nro} emitida`,
                    tx
                );

                return { ok: true };
            } catch (err) {
                return {
                    ok: false,
                    error: err instanceof Error ? err.message : "No se pudo emitir la Factura B"
                };
            }
        });

    return { emit };
}

export type InvoiceService = ReturnType<typeof createInvoiceService>;
