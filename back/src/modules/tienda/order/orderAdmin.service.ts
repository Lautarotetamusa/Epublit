import type { Database, Tx } from "../../../db/client";
import { Conflict } from "../../../lib/http/errors";
import type { Storage } from "../../../lib/storage/storage";
import type { ClienteRepository } from "../../cliente";
import type { ComprobanteService } from "../../comprobante";
import type { DepositoRepository } from "../../deposito";
import type { LibroService } from "../../libro";
import type { MedioPagoService } from "../../medioPago";
import type { UserRepository } from "../../user";
import type { MercadoPagoClient } from "../payment/mercadopago.client";
import type { MercadoPagoService } from "../payment/mercadopago.service";
import type { PaymentRepository } from "../payment/payment.repository";
import type { ShipmentRepository } from "../shipping/shipment.repository";
import { toLabelResponse } from "../shipping/shipment.serializer";
import type { VentaRepository } from "../../transaccion/venta.repository";
import type { SaleService } from "../../transaccion/sale.service";
import type { AvailabilityService } from "../stock/availability.service";
import type { LabelService } from "./label.service";
import type { TrackingService } from "./tracking.service";
import type { OrderAdminRepository, ListOrdersFilter } from "./orderAdmin.repository";
import type { OrderRepository, OrderRow } from "./order.repository";
import { toOrderDetail, toOrderSummary, type OrderDetailData } from "./orderAdmin.serializer";
import { OrderAdminError } from "./orderAdmin.errors";
import {
    argentinaDayEnd,
    argentinaDayStart,
    type AddressCorrection,
    type ListOrdersQuery
} from "./orderAdmin.validator";

export type OrderAdminServiceDeps = {
    db: Database;
    orderRepository: OrderRepository;
    orderAdminRepository: OrderAdminRepository;
    paymentRepository: PaymentRepository;
    shipmentRepository: ShipmentRepository;
    ventaRepository: Pick<VentaRepository, "findRowByIdMovimiento">;
    clienteRepository: Pick<ClienteRepository, "findConsumidorFinal">;
    depositoRepository: Pick<DepositoRepository, "findPrincipal">;
    medioPagoService: Pick<MedioPagoService, "findActivos" | "findActivo">;
    libroService: Pick<LibroService, "findOne">;
    userRepository: Pick<UserRepository, "findOne">;
    availabilityService: Pick<AvailabilityService, "convert" | "release">;
    saleService: Pick<SaleService, "record">;
    comprobanteService: Pick<
        ComprobanteService,
        "crearFactura" | "emitirSiPendiente" | "reintentar" | "resumenPorId"
    >;
    labelService: Pick<LabelService, "ensure">;
    trackingService: Pick<TrackingService, "getBlock" | "refresh">;
    mercadoPagoService: Pick<MercadoPagoService, "getAccessToken">;
    mercadoPagoClient: Pick<MercadoPagoClient, "refundPayment">;
    storage: Storage;
};

const MERCADOPAGO = "mercadopago";
const FACTURA_B = 6;

export function createOrderAdminService({
    db,
    orderRepository,
    orderAdminRepository,
    paymentRepository,
    shipmentRepository,
    ventaRepository,
    clienteRepository,
    depositoRepository,
    medioPagoService,
    libroService,
    userRepository,
    availabilityService,
    saleService,
    comprobanteService,
    labelService,
    trackingService,
    mercadoPagoService,
    mercadoPagoClient,
    storage
}: OrderAdminServiceDeps) {
    const loadDetail = async (userId: number, codigo: string) => {
        const { pedido, items, historial } = await orderRepository.getFull(userId, codigo);

        const [pago, envio, venta, comprobante] = await Promise.all([
            paymentRepository.findLatestForOrder(pedido.id, userId),
            pedido.entrega_tipo === "envio"
                ? shipmentRepository.findByOrder(pedido.id, userId)
                : Promise.resolve(null),
            pedido.venta_id === null
                ? Promise.resolve(null)
                : ventaRepository.findRowByIdMovimiento(pedido.venta_id, userId),
            pedido.comprobante_id === null
                ? Promise.resolve(null)
                : comprobanteService.resumenPorId(pedido.comprobante_id, userId)
        ]);

        const envioEventos = envio
            ? await shipmentRepository.getEvents(envio.id, userId)
            : [];

        const data: OrderDetailData = { pedido, items, historial, pago, envio, envioEventos, venta, comprobante };
        return toOrderDetail(data);
    };

    const list = async (userId: number, query: ListOrdersQuery) => {
        const filter: ListOrdersFilter = {
            estado: query.estado && query.estado !== "todos" ? query.estado : undefined,
            desde: query.desde ? argentinaDayStart(query.desde) : undefined,
            hasta: query.hasta ? argentinaDayEnd(query.hasta) : undefined,
            entrega: query.entrega,
            buscar: query.buscar,
            pagina: query.pagina,
            porPagina: query.porPagina
        };

        const page = await orderAdminRepository.list(userId, filter);

        return {
            pedidos: page.pedidos.map(toOrderSummary),
            total: page.total,
            pagina: filter.pagina,
            porPagina: filter.porPagina,
            conteos: page.conteos
        };
    };

    const getLabel = async (userId: number, codigo: string) => {
        const pedido = await orderRepository.findByCode(userId, codigo);

        if (pedido.entrega_tipo === "retiro") {
            throw new OrderAdminError(409, "sin_envio", "Un pedido de retiro no tiene etiqueta");
        }

        const shipment = await shipmentRepository.findByOrder(pedido.id, userId);
        if (!shipment?.etiqueta_file_path) {
            throw new OrderAdminError(404, "no_encontrado", "La etiqueta todavía no se generó");
        }
        if (!(await storage.exists(shipment.etiqueta_file_path))) {
            throw new OrderAdminError(404, "no_encontrado", "El archivo de la etiqueta no existe");
        }

        return {
            data: await storage.read(shipment.etiqueta_file_path),
            filename: `etiqueta-${pedido.codigo}.pdf`
        };
    };

    const acceptanceDependencies = async (userId: number) => {
        const [cliente, medios, deposito, user] = await Promise.all([
            clienteRepository.findConsumidorFinal(userId),
            medioPagoService.findActivos(userId),
            depositoRepository.findPrincipal(userId),
            userRepository.findOne({ id: userId })
        ]);

        if (!cliente) {
            throw new OrderAdminError(
                409,
                "transicion_invalida",
                "Falta el cliente CONSUMIDOR FINAL de la cuenta; sin él no se puede facturar el pedido"
            );
        }

        if (user.punto_venta === null || user.punto_venta === undefined) {
            throw new OrderAdminError(
                409,
                "transicion_invalida",
                "La cuenta no tiene punto de venta configurado; cargalo en el perfil antes de aceptar pedidos"
            );
        }

        const medioPago = medios.find((medio) => medio.nombre.toLowerCase() === MERCADOPAGO);
        if (!medioPago) {
            throw new OrderAdminError(
                409,
                "transicion_invalida",
                "Falta el medio de pago MercadoPago de la cuenta; crealo para poder aceptar pedidos"
            );
        }

        return { cliente, medioPago, deposito, user };
    };

    const registrarFacturaEmitida = async (
        userId: number,
        pedidoId: number,
        comprobanteId: number
    ): Promise<void> => {
        const comprobante = await comprobanteService.resumenPorId(comprobanteId, userId);
        if (!comprobante || comprobante.estado !== "emitida") return;
        if (await orderRepository.hasHistory(pedidoId, userId, "comprobante_emitido")) return;

        await orderRepository.insertHistory(
            pedidoId,
            userId,
            "comprobante_emitido",
            `${comprobante.tipo?.nombre ?? "Comprobante"} ${comprobante.numeroCompleto ?? ""} emitida`
        );
    };

    const accept = async (userId: number, codigo: string) => {
        const { pedidoId, comprobanteId } = await db.transaction(async (tx) => {
            const pedido = await orderRepository.findByCode(userId, codigo, tx, true);

            if (pedido.estado !== "pagado") {
                throw new OrderAdminError(
                    409,
                    "transicion_invalida",
                    "Sólo se acepta un pedido pagado"
                );
            }
            if (pedido.estado_pago !== "aprobado") {
                throw new OrderAdminError(
                    409,
                    "pago_no_aprobado",
                    "El pedido no tiene un pago aprobado"
                );
            }

            const { cliente, medioPago, deposito, user } = await acceptanceDependencies(userId);
            const items = await orderRepository.getItems(pedido.id, userId, tx);

            // La línea congela el id interno del libro al crear el pedido. Si
            // es un pedido viejo sin `id_libro`, se resuelve por ISBN.
            const lines = await Promise.all(
                items.map(async (item) => ({
                    id_libro:
                        item.id_libro ??
                        (await libroService.findOne(item.isbn, userId)).id_libro,
                    isbn: item.isbn,
                    titulo: item.titulo,
                    cantidad: item.cantidad,
                    precio: item.precio_unitario
                }))
            );

            const { movimiento, venta } = await saleService.record(
                {
                    userId,
                    tipo: "venta",
                    idCliente: cliente.id,
                    idMedioPago: medioPago.id,
                    comision: medioPago.comision,
                    tipoCbte: FACTURA_B,
                    descuento: 0,
                    total: pedido.total,
                    lines,
                    origen: { tipo: "deposito", id: deposito.id },
                    destino: { tipo: "exterior" }
                },
                tx
            );

            const comprobante = await comprobanteService.crearFactura(
                {
                    userId,
                    movimientoId: movimiento.id,
                    venta,
                    cliente,
                    emisor: user,
                    medioPago,
                    lineas: lines,
                    importeEnvio: pedido.costo_envio
                },
                tx
            );

            // La reserva ya cubría estas unidades: se convierte en venta y el
            // stock físico se movió una sola vez en `saleService.record`.
            await availabilityService.convert(pedido.id, userId, tx);

            await orderRepository.updateOrder(
                userId,
                pedido.id,
                {
                    estado: "aceptado",
                    venta_id: movimiento.id,
                    comprobante_id: comprobante.id
                },
                tx
            );

            await orderRepository.insertHistory(
                pedido.id,
                userId,
                "pedido_aceptado",
                "Pedido aceptado y venta generada",
                tx
            );

            return { pedidoId: pedido.id, comprobanteId: comprobante.id };
        });

        // La factura se intenta después del commit: un fallo de AFIP no
        // revierte la venta ni la aceptación.
        await comprobanteService.emitirSiPendiente(comprobanteId, userId);
        await registrarFacturaEmitida(userId, pedidoId, comprobanteId);

        return loadDetail(userId, codigo);
    };

    const retryInvoice = async (userId: number, codigo: string) => {
        const pedido = await orderRepository.findByCode(userId, codigo);

        if (!["aceptado", "enviado", "entregado"].includes(pedido.estado)) {
            throw new OrderAdminError(
                409,
                "transicion_invalida",
                "Sólo se factura un pedido aceptado, enviado o entregado"
            );
        }
        if (pedido.comprobante_id === null) {
            throw new OrderAdminError(
                409,
                "transicion_invalida",
                "El pedido todavía no tiene un comprobante para facturar"
            );
        }

        try {
            await comprobanteService.reintentar(pedido.comprobante_id, userId);
        } catch (error) {
            if (error instanceof Conflict) {
                throw new OrderAdminError(409, "transicion_invalida", error.message);
            }

            throw new OrderAdminError(
                502,
                "facturacion_fallida",
                error instanceof Error ? error.message : "No se pudo emitir la Factura B"
            );
        }

        await registrarFacturaEmitida(userId, pedido.id, pedido.comprobante_id);

        return loadDetail(userId, codigo);
    };

    const refundApprovedPayment = async (
        userId: number,
        pedido: OrderRow,
        tx: Tx
    ) => {
        const pago = await paymentRepository.findLatestForOrder(pedido.id, userId, tx);

        if (!pago?.pago_id) {
            throw new OrderAdminError(
                502,
                "proveedor_no_disponible",
                "No hay un pago de MercadoPago para reembolsar"
            );
        }

        let accessToken: string;
        try {
            accessToken = await mercadoPagoService.getAccessToken(userId);
            const reembolso = await mercadoPagoClient.refundPayment(accessToken, pago.pago_id);
            await paymentRepository.update(
                pago.id,
                userId,
                { estado: "reembolsado", datos_reembolso: { reembolso } },
                tx
            );
        } catch {
            throw new OrderAdminError(
                502,
                "proveedor_no_disponible",
                "MercadoPago no confirmó el reembolso; el pedido no cambió y se puede reintentar"
            );
        }
    };

    const reject = async (
        userId: number,
        codigo: string,
        input: { motivo: string; detalle?: string }
    ) => {
        await db.transaction(async (tx) => {
            const pedido = await orderRepository.findByCode(userId, codigo, tx, true);

            if (!["pendiente_pago", "pagado"].includes(pedido.estado)) {
                throw new OrderAdminError(
                    409,
                    "transicion_invalida",
                    "El pedido ya no se puede rechazar"
                );
            }

            const reembolsar = pedido.estado_pago === "aprobado";
            if (reembolsar) {
                await refundApprovedPayment(userId, pedido, tx);
            }

            await orderRepository.updateOrder(
                userId,
                pedido.id,
                {
                    estado: "rechazado",
                    estado_pago: reembolsar ? "reembolsado" : pedido.estado_pago,
                    motivo_rechazo: input.motivo,
                    detalle_rechazo: input.detalle ?? null
                },
                tx
            );

            await availabilityService.release(pedido.id, userId, tx);

            await orderRepository.insertHistory(
                pedido.id,
                userId,
                "pedido_rechazado",
                input.detalle ? `${input.motivo}: ${input.detalle}` : input.motivo,
                tx
            );

            if (reembolsar) {
                await orderRepository.insertHistory(
                    pedido.id,
                    userId,
                    "pago_reembolsado",
                    "Pago reembolsado por MercadoPago",
                    tx
                );
            }
        });

        return loadDetail(userId, codigo);
    };

    const generateLabel = async (userId: number, codigo: string, direccion?: AddressCorrection) => {
        const { shipment } = await labelService.ensure(userId, codigo, { direccion });
        return toLabelResponse(codigo, shipment);
    };

    const ship = async (userId: number, codigo: string) => {
        const pedido = await orderRepository.findByCode(userId, codigo);

        if (pedido.entrega_tipo === "retiro") {
            throw new OrderAdminError(409, "sin_envio", "Un pedido de retiro no se despacha");
        }
        if (pedido.estado !== "aceptado") {
            throw new OrderAdminError(
                409,
                "transicion_invalida",
                "Sólo se despacha un pedido aceptado"
            );
        }

        // Genera o reutiliza la etiqueta fuera de la transacción de despacho.
        const { shipment } = await labelService.ensure(userId, codigo);

        await db.transaction(async (tx) => {
            const actual = await orderRepository.findByCode(userId, codigo, tx, true);

            if (actual.estado !== "aceptado") {
                throw new OrderAdminError(
                    409,
                    "transicion_invalida",
                    "El pedido ya no está aceptado"
                );
            }

            await orderRepository.updateOrder(
                userId,
                actual.id,
                { estado: "enviado" },
                tx
            );

            await shipmentRepository.update(
                shipment.id,
                userId,
                { despachado_en: new Date(), ultima_actualizacion: new Date() },
                tx
            );

            await orderRepository.insertHistory(
                actual.id,
                userId,
                "pedido_enviado",
                "Pedido despachado",
                tx
            );
        });

        return loadDetail(userId, codigo);
    };

    const deliver = async (userId: number, codigo: string) => {
        await db.transaction(async (tx) => {
            const pedido = await orderRepository.findByCode(userId, codigo, tx, true);

            const puedeEntregar =
                pedido.estado === "enviado" ||
                (pedido.estado === "aceptado" && pedido.entrega_tipo === "retiro");

            if (!puedeEntregar) {
                throw new OrderAdminError(
                    409,
                    "transicion_invalida",
                    "Sólo se entrega un pedido enviado o uno aceptado con retiro"
                );
            }

            await orderRepository.updateOrder(
                userId,
                pedido.id,
                { estado: "entregado" },
                tx
            );

            await orderRepository.insertHistory(
                pedido.id,
                userId,
                "pedido_entregado",
                pedido.entrega_tipo === "retiro"
                    ? "Pedido retirado en local"
                    : "Pedido entregado",
                tx
            );
        });

        return loadDetail(userId, codigo);
    };

    return {
        list,
        detail: loadDetail,
        getLabel,
        getShipping: trackingService.getBlock,
        refreshTracking: trackingService.refresh,
        accept,
        retryInvoice,
        reject,
        generateLabel,
        ship,
        deliver
    };
}

export type OrderAdminService = ReturnType<typeof createOrderAdminService>;
