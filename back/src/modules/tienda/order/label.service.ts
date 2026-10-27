import type { Database } from "../../../db/client";
import { ExternalServiceError } from "../../../lib/http/errors";
import type { Storage } from "../../../lib/storage/storage";
import type { UserRepository } from "../../user";
import type { PaqarClient, PaqarOrderInput } from "../shipping/clients/paqar.client";
import type { ShippingConfigService, ShippingOperation } from "../shipping/shippingConfig.service";
import type { ShipmentRepository, ShipmentRow } from "../shipping/shipment.repository";
import type { OrderRepository, OrderRow } from "./order.repository";
import { OrderAdminError } from "./orderAdmin.errors";
import type { AddressCorrection } from "./orderAdmin.validator";

export type LabelServiceDeps = {
    db: Database;
    orderRepository: OrderRepository;
    shipmentRepository: ShipmentRepository;
    shippingConfigService: Pick<ShippingConfigService, "getOperation">;
    paqarClient: Pick<PaqarClient, "createOrder" | "createLabel">;
    storage: Storage;
    userRepository: Pick<UserRepository, "findOne">;
};

type Address = {
    calle: string;
    numero: string;
    piso: string | null;
    depto: string | null;
    localidad: string;
    provincia: string;
    codigoPostal: string;
};

const addressFromOrder = (pedido: OrderRow): Address => ({
    calle: pedido.entrega_calle ?? "",
    numero: pedido.entrega_numero ?? "",
    piso: pedido.entrega_piso,
    depto: pedido.entrega_depto,
    localidad: pedido.entrega_localidad ?? "",
    provincia: pedido.entrega_provincia ?? "",
    codigoPostal: pedido.entrega_codigo_postal ?? ""
});

const mergeAddress = (pedido: OrderRow, correction?: AddressCorrection): Address => {
    const actual = addressFromOrder(pedido);
    if (!correction) return actual;

    return {
        calle: correction.calle ?? actual.calle,
        numero: correction.numero ?? actual.numero,
        piso: correction.piso ?? actual.piso,
        depto: correction.depto ?? actual.depto,
        localidad: correction.localidad ?? actual.localidad,
        provincia: correction.provincia ?? actual.provincia,
        codigoPostal: correction.codigoPostal ?? actual.codigoPostal
    };
};

const isCompleteAddress = (address: Address): boolean =>
    [address.calle, address.numero, address.localidad, address.provincia, address.codigoPostal].every(
        (value) => value.trim().length > 0
    );

const isDuplicateError = (err: unknown): boolean => {
    if (err instanceof ExternalServiceError && err.status === 409) return true;

    const details =
        err instanceof ExternalServiceError ? JSON.stringify(err.details ?? "") : "";
    const message = err instanceof Error ? err.message : "";

    return `${details} ${message}`.toLowerCase().includes("duplic");
};

const asProviderError = (err: unknown): OrderAdminError => {
    if (err instanceof OrderAdminError) return err;

    if (isDuplicateError(err)) {
        return new OrderAdminError(
            409,
            "etiqueta_duplicada",
            "PAQ.AR ya tiene una etiqueta para este envío y no se pudo reconciliar"
        );
    }

    return new OrderAdminError(
        502,
        "proveedor_no_disponible",
        "PAQ.AR no pudo generar la etiqueta; el pedido sigue aceptado y se puede reintentar"
    );
};

const senderData = (
    config: ShippingOperation,
    user: { razon_social: string; email: string | null }
): PaqarOrderInput["senderData"] => ({
    businessName: user.razon_social,
    email: user.email ?? undefined,
    address: {
        streetName: config.origen.calle ?? "",
        streetNumber: config.origen.numero ?? "",
        floor: config.origen.piso ?? undefined,
        department: config.origen.depto ?? undefined,
        cityName: config.origen.localidad ?? "",
        state: config.origen.provincia ?? "",
        zipCode: config.origen.codigoPostal ?? ""
    }
});

const shippingData = (pedido: OrderRow, address: Address): PaqarOrderInput["shippingData"] => ({
    name: pedido.comprador_nombre,
    email: pedido.comprador_email ?? undefined,
    phoneNumber: pedido.comprador_telefono ?? undefined,
    address: {
        streetName: address.calle,
        streetNumber: address.numero,
        floor: address.piso ?? undefined,
        department: address.depto ?? undefined,
        cityName: address.localidad,
        state: address.provincia,
        zipCode: address.codigoPostal
    }
});

// PAQ.AR valida `saleDate` con el offset de Argentina (`YYYY-MM-DDTHH:mm:ss-03:00`).
const argentinaSaleDate = (fecha: Date): string => {
    const local = new Date(fecha.getTime() - 3 * 60 * 60 * 1000);
    return local.toISOString().replace("Z", "-03:00");
};

const assertOrderCanHaveLabel = (pedido: OrderRow): void => {
    if (pedido.entrega_tipo === "retiro") {
        throw new OrderAdminError(409, "sin_envio", "Un pedido de retiro no genera etiqueta");
    }
    if (pedido.estado !== "aceptado") {
        throw new OrderAdminError(
            409,
            "transicion_invalida",
            "Sólo se genera la etiqueta de un pedido aceptado"
        );
    }
};

export function createLabelService({
    db,
    orderRepository,
    shipmentRepository,
    shippingConfigService,
    paqarClient,
    storage,
    userRepository
}: LabelServiceDeps) {
    const ensurePaqarOrder = async (
        userId: number,
        pedido: OrderRow,
        config: ShippingOperation,
        address: Address,
        pesoKg: number,
        caja: { altoCm: number; anchoCm: number; largoCm: number },
        actual: ShipmentRow | null,
        tx: Parameters<Parameters<Database["transaction"]>[0]>[0]
    ): Promise<ShipmentRow> => {
        if (actual?.codigo_seguimiento) return actual;

        const user = await userRepository.findOne({ id: userId });

        let orden;
        try {
            orden = await paqarClient.createOrder(config.paqar!, {
                sellerId: config.paqar!.sellerId,
                senderData: senderData(config, user),
                shippingData: shippingData(pedido, address),
                parcels: [
                    {
                        dimensions: {
                            height: String(caja.altoCm),
                            width: String(caja.anchoCm),
                            depth: String(caja.largoCm)
                        },
                        productWeight: String(Math.ceil(pesoKg * 1000)),
                        productCategory: "Libros",
                        declaredValue: String(pedido.total)
                    }
                ],
                deliveryType: "homeDelivery",
                agencyId: "",
                // La venta se concretó al aceptar el pedido, no al crearlo.
                saleDate: argentinaSaleDate(pedido.actualizado_en),
                serviceType: "CP",
                shipmentClientId: pedido.codigo,
                trackingNumber: actual?.codigo_seguimiento ?? null
            });
        } catch (err) {
            throw asProviderError(err);
        }

        if (!orden.shipmentId || !orden.trackingNumber) {
            throw new OrderAdminError(
                502,
                "proveedor_no_disponible",
                "PAQ.AR no devolvió número de envío y código de seguimiento"
            );
        }

        if (actual) {
            return shipmentRepository.update(
                actual.id,
                userId,
                {
                    proveedor_envio_id: orden.shipmentId,
                    codigo_seguimiento: orden.trackingNumber,
                    estado: actual.estado ?? "en_preparacion",
                    ultima_actualizacion: new Date()
                },
                tx
            );
        }

        return shipmentRepository.insert(
            {
                user: userId,
                pedido_id: pedido.id,
                proveedor: "paqar",
                proveedor_envio_id: orden.shipmentId,
                codigo_seguimiento: orden.trackingNumber,
                estado: "en_preparacion",
                ultima_actualizacion: new Date()
            },
            tx
        );
    };

    const ensureLabelPdf = async (
        userId: number,
        codigo: string,
        config: ShippingOperation,
        shipment: ShipmentRow,
        tx: Parameters<Parameters<Database["transaction"]>[0]>[0]
    ): Promise<ShipmentRow> => {
        if (shipment.etiqueta_file_path) return shipment;

        let label;
        try {
            label = await paqarClient.createLabel(
                config.paqar!,
                config.paqar!.sellerId,
                shipment.codigo_seguimiento!
            );
        } catch (err) {
            throw asProviderError(err);
        }

        const key = `etiquetas/${codigo}-${Date.now()}.pdf`;
        await storage.write(key, label.pdf);

        return shipmentRepository.update(
            shipment.id,
            userId,
            {
                etiqueta_file_path: key,
                etiqueta_url: label.url ?? `/pedidos/${codigo}/etiqueta`,
                etiqueta_creada_en: new Date(),
                ultima_actualizacion: new Date()
            },
            tx
        );
    };

    const ensure = async (
        userId: number,
        codigo: string,
        options: { direccion?: AddressCorrection } = {}
    ): Promise<{ pedido: OrderRow; shipment: ShipmentRow }> =>
        db.transaction(async (tx) => {
            let pedido = await orderRepository.findByCode(userId, codigo, tx, true);
            assertOrderCanHaveLabel(pedido);

            const existente = await shipmentRepository.findByOrder(pedido.id, userId, tx);
            if (existente?.etiqueta_file_path) {
                return { pedido, shipment: existente };
            }

            const config = await shippingConfigService.getOperation(userId);
            if (!config.paqar || !config.origen.calle || !config.origen.codigoPostal) {
                throw new OrderAdminError(
                    422,
                    "correo_no_configurado",
                    "Falta configurar PAQ.AR y el domicilio de origen"
                );
            }

            const direccion = mergeAddress(pedido, options.direccion);
            if (!isCompleteAddress(direccion)) {
                throw new OrderAdminError(
                    422,
                    "direccion_invalida",
                    "La dirección de entrega está incompleta; corregila y reintentá"
                );
            }

            const pesoKg = pedido.peso_kg ?? config.pesoPromedioKg;
            if (pesoKg === null || pesoKg === undefined || pesoKg <= 0) {
                throw new OrderAdminError(
                    422,
                    "peso_faltante",
                    "El pedido no tiene peso y la cuenta no tiene peso promedio configurado"
                );
            }

            if (options.direccion) {
                pedido = await orderRepository.updateOrder(
                    userId,
                    pedido.id,
                    {
                        entrega_calle: direccion.calle,
                        entrega_numero: direccion.numero,
                        entrega_piso: direccion.piso,
                        entrega_depto: direccion.depto,
                        entrega_localidad: direccion.localidad,
                        entrega_provincia: direccion.provincia,
                        entrega_codigo_postal: direccion.codigoPostal
                    },
                    tx
                );
            }

            const caja = {
                altoCm: pedido.caja_alto_cm ?? config.cajaDefault.altoCm,
                anchoCm: pedido.caja_ancho_cm ?? config.cajaDefault.anchoCm,
                largoCm: pedido.caja_largo_cm ?? config.cajaDefault.largoCm
            };

            const conOrden = await ensurePaqarOrder(
                userId,
                pedido,
                config,
                direccion,
                pesoKg,
                caja,
                existente,
                tx
            );
            const conEtiqueta = await ensureLabelPdf(userId, codigo, config, conOrden, tx);

            if (!existente?.etiqueta_file_path) {
                await orderRepository.insertHistory(
                    pedido.id,
                    userId,
                    "etiqueta_generada",
                    "Etiqueta de PAQ.AR generada",
                    tx
                );
            }

            return { pedido, shipment: conEtiqueta };
        });

    return { ensure };
}

export type LabelService = ReturnType<typeof createLabelService>;
