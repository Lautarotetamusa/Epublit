import { createHash } from "crypto";
import type { Database } from "../../../db/client";
import type { PaqarClient, PaqarTrackingEvent } from "../shipping/clients/paqar.client";
import type { ShippingConfigService } from "../shipping/shippingConfig.service";
import type { ShipmentRepository } from "../shipping/shipment.repository";
import { toShippingBlock, type ShippingBlock } from "../shipping/shipment.serializer";
import type { OrderRepository } from "./order.repository";
import { OrderAdminError } from "./orderAdmin.errors";

export type TrackingServiceDeps = {
    db: Database;
    orderRepository: OrderRepository;
    shipmentRepository: ShipmentRepository;
    shippingConfigService: Pick<ShippingConfigService, "getOperation">;
    paqarClient: Pick<PaqarClient, "getTracking">;
};

const TRACKING_ERROR =
    "No se pudo actualizar el seguimiento con PAQ.AR; se muestra el último estado conocido";

const eventKey = (event: PaqarTrackingEvent): string =>
    createHash("sha256")
        .update(
            JSON.stringify({
                statusId: event.statusId,
                status: event.status,
                date: event.date?.toISOString() ?? null,
                facility: event.facility,
                sign: event.sign
            })
        )
        .digest("hex");

export function createTrackingService({
    db,
    orderRepository,
    shipmentRepository,
    shippingConfigService,
    paqarClient
}: TrackingServiceDeps) {
    const getBlock = async (userId: number, codigo: string): Promise<ShippingBlock> => {
        const pedido = await orderRepository.findByCode(userId, codigo);

        if (pedido.entrega_tipo === "retiro") {
            throw new OrderAdminError(409, "sin_envio", "Un pedido de retiro no tiene seguimiento");
        }

        const shipment = await shipmentRepository.findByOrder(pedido.id, userId);
        const events = shipment
            ? await shipmentRepository.getEvents(shipment.id, userId)
            : [];

        return toShippingBlock(pedido.codigo, shipment, events);
    };

    const refresh = async (userId: number, codigo: string): Promise<ShippingBlock> => {
        const pedido = await orderRepository.findByCode(userId, codigo);

        if (pedido.entrega_tipo === "retiro") {
            throw new OrderAdminError(409, "sin_envio", "Un pedido de retiro no tiene seguimiento");
        }

        const shipment = await shipmentRepository.findByOrder(pedido.id, userId);
        if (!shipment?.codigo_seguimiento) {
            throw new OrderAdminError(
                409,
                "sin_envio",
                "El pedido todavía no tiene un código de seguimiento"
            );
        }

        const events = await shipmentRepository.getEvents(shipment.id, userId);
        const config = await shippingConfigService.getOperation(userId);

        if (!config.paqar) {
            return toShippingBlock(pedido.codigo, shipment, events, TRACKING_ERROR);
        }

        let tracking;
        try {
            tracking = await paqarClient.getTracking(
                config.paqar,
                shipment.codigo_seguimiento
            );
        } catch {
            return toShippingBlock(pedido.codigo, shipment, events, TRACKING_ERROR);
        }

        return db.transaction(async (tx) => {
            const actualizado = await shipmentRepository.update(
                shipment.id,
                userId,
                {
                    estado: tracking.status ?? shipment.estado,
                    ultima_actualizacion: new Date(),
                    url_seguimiento: tracking.url ?? shipment.url_seguimiento
                },
                tx
            );

            for (const event of tracking.events) {
                await shipmentRepository.insertEvent(
                    {
                        user: userId,
                        envio_id: shipment.id,
                        evento_proveedor_id: eventKey(event),
                        estado: event.status,
                        status_id: event.statusId,
                        facility: event.facility,
                        sign: event.sign,
                        descripcion: event.sign ?? event.facility,
                        fecha_evento: event.date
                    },
                    tx
                );
            }

            const eventos = await shipmentRepository.getEvents(shipment.id, userId, tx);
            return toShippingBlock(pedido.codigo, actualizado, eventos);
        });
    };

    return { getBlock, refresh };
}

export type TrackingService = ReturnType<typeof createTrackingService>;
