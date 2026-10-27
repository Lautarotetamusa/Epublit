import { createHash, randomUUID, timingSafeEqual } from "crypto";
import { sql } from "drizzle-orm";
import { Database, Tx } from "../../../db/client";
import type { MercadoPagoClient } from "../payment/mercadopago.client";
import type { QuoteService } from "../shipping/quote.service";
import type { AvailabilityService } from "../stock/availability.service";
import { mergeItems } from "../shipping/quote.validator";
import type { AuthenticatedIntegration } from "../integration/integration.service";
import type { MercadoPagoService } from "../payment/mercadopago.service";
import type { PaymentRepository } from "../payment/payment.repository";
import type { OrderRepository, OrderRow } from "./order.repository";
import { toPaymentSummary, toPublicOrder } from "./order.serializer";
import type { CreateOrderInput } from "./order.validator";
import { PublicApiError } from "../shared/public.errors";

export type CheckoutServiceDeps = {
    db: Database;
    orderRepository: OrderRepository;
    paymentRepository: PaymentRepository;
    quoteService: Pick<QuoteService, "resolveBooks" | "calculateShipping" | "isPickupAvailable">;
    availabilityService: Pick<AvailabilityService, "reserve" | "release">;
    mercadoPagoService: Pick<MercadoPagoService, "getAccessToken" | "getConnection" | "getConfig">;
    mercadoPagoClient: Pick<MercadoPagoClient, "createPreference">;
};

const RESERVATION_DURATION_MS = 30 * 60 * 1000;

const canonicalDelivery = (entrega: CreateOrderInput["entrega"]) => {
    if (entrega.tipo === "retiro") return { tipo: "retiro" };

    return {
        tipo: "envio",
        direccion: {
            calle: entrega.direccion.calle,
            numero: entrega.direccion.numero,
            piso: entrega.direccion.piso ?? null,
            depto: entrega.direccion.depto ?? null,
            localidad: entrega.direccion.localidad,
            provincia: entrega.direccion.provincia,
            codigoPostal: entrega.direccion.codigoPostal
        }
    };
};

const canonicalBody = (input: CreateOrderInput) => {
    const items = mergeItems(input.items)
        .sort((a, b) => a.isbn.localeCompare(b.isbn))
        .map((item) => ({ isbn: item.isbn, cantidad: item.cantidad }));

    return {
        comprador: {
            nombre: input.comprador.nombre,
            email: input.comprador.email,
            telefono: input.comprador.telefono ?? null,
            documento: input.comprador.documento ?? null
        },
        entrega: canonicalDelivery(input.entrega),
        items,
        urlRetorno: input.urlRetorno
    };
};

const sameReference = (esperada: string, recibida: string): boolean => {
    const a = Buffer.from(esperada);
    const b = Buffer.from(recibida);
    return a.length === b.length && timingSafeEqual(a, b);
};

const hashBody = (input: CreateOrderInput): string =>
    createHash("sha256").update(JSON.stringify(canonicalBody(input))).digest("hex");

const assertReturnUrlOrigin = (urlRetorno: string, origen: string) => {
    let url: URL;

    try {
        url = new URL(urlRetorno);
    } catch {
        throw new PublicApiError(400, "validacion", "La URL de retorno no es válida");
    }

    if (
        (url.protocol !== "https:" && url.protocol !== "http:") ||
        url.username !== "" ||
        url.password !== "" ||
        url.origin !== origen
    ) {
        throw new PublicApiError(400, "validacion", "La URL de retorno no pertenece al origen permitido");
    }
};

export function createCheckoutService({
    db,
    orderRepository,
    paymentRepository,
    quoteService,
    availabilityService,
    mercadoPagoService,
    mercadoPagoClient
}: CheckoutServiceDeps) {
    // Los códigos son correlativos y la API key vive en el JS de la tienda: la
    // referencia (UUID que solo conoce el comprador) es lo que prueba que el
    // pedido es suyo. Una referencia incorrecta responde igual que un pedido
    // inexistente para no confirmar qué códigos existen.
    const findBuyerOrder = async (userId: number, codigo: string, referencia: string | undefined) => {
        const pedido = await orderRepository.findByCode(userId, codigo).catch(() => null);
        if (!pedido || !referencia || !sameReference(pedido.referencia_externa, referencia)) {
            throw new PublicApiError(404, "no_encontrado", `No existe el pedido ${codigo}`);
        }
        return pedido;
    };

    const getPublic = async (userId: number, codigo: string, referencia: string | undefined) =>
        getPublicOrder(userId, await findBuyerOrder(userId, codigo, referencia));

    const getPublicOrder = async (userId: number, pedido: OrderRow) => {
        const items = await orderRepository.getItems(pedido.id, userId);
        const pago = await paymentRepository.findLatestForOrder(pedido.id, userId);
        return toPublicOrder(pedido, items, toPaymentSummary(pago, pedido));
    };

    const quoteError = (motivo: string, mensaje: string): PublicApiError => {
        if (motivo === "proveedor_no_disponible") {
            return new PublicApiError(502, "proveedor_no_disponible", mensaje);
        }
        if (motivo === "peso_faltante") {
            return new PublicApiError(422, "peso_faltante", mensaje);
        }
        if (motivo === "correo_no_configurado") {
            return new PublicApiError(422, "correo_no_configurado", mensaje);
        }

        return new PublicApiError(422, "entrega_no_disponible", mensaje);
    };

    const resolveDelivery = async (
        userId: number,
        input: CreateOrderInput,
        libros: Awaited<ReturnType<QuoteService["resolveBooks"]>>
    ) => {
        if (input.entrega.tipo === "envio") {
            const envio = await quoteService.calculateShipping(
                userId,
                libros,
                input.entrega.direccion.codigoPostal
            );
            if (!envio.disponible) throw quoteError(envio.motivo, envio.mensaje);

            return {
                envio,
                retiro: null,
                direccion: input.entrega.direccion,
                costoEnvio: envio.costo,
                pesoKg: envio.pesoKg,
                caja: envio.caja
            };
        }

        const retiro = await quoteService.isPickupAvailable(userId);
        if (!retiro.disponible) {
            throw new PublicApiError(422, "entrega_no_disponible", "El retiro en local no está disponible");
        }

        return { envio: null, retiro, direccion: null, costoEnvio: 0, pesoKg: null, caja: null };
    };

    const preferenceBody = (
        pedido: OrderRow,
        items: { isbn: string; titulo: string; cantidad: number; precioUnitario: number }[],
        mpUserId: string,
        urlRetorno: string,
        venceEn: Date
    ) => {
        const config = mercadoPagoService.getConfig();
        const notificationUrl = new URL(config.webhookUrl);
        notificationUrl.searchParams.set("user_id", mpUserId);

        const preferenceItems = items.map((item) => ({
            id: item.isbn,
            title: item.titulo,
            quantity: item.cantidad,
            unit_price: item.precioUnitario,
            currency_id: "ARS"
        }));

        if (pedido.costo_envio > 0) {
            preferenceItems.push({
                id: "envio",
                title: "Envío",
                quantity: 1,
                unit_price: pedido.costo_envio,
                currency_id: "ARS"
            });
        }

        const backUrls = {
            success: urlRetorno,
            failure: urlRetorno,
            pending: urlRetorno
        };

        return {
            items: preferenceItems,
            payer: {
                name: pedido.comprador_nombre,
                email: pedido.comprador_email
            },
            back_urls: backUrls,
            ...(urlRetorno.startsWith("https://") ? { auto_return: "approved" } : {}),
            notification_url: notificationUrl.toString(),
            external_reference: pedido.referencia_externa,
            metadata: { pedido: pedido.codigo },
            expires: true,
            expiration_date_to: venceEn.toISOString(),
            statement_descriptor: "EPUBLIT",
            // Efectivo (Rapipago/Pago Fácil) y cajero se acreditan días después,
            // cuando la reserva de 30 minutos ya venció y el pago se reembolsaría.
            payment_methods: {
                excluded_payment_types: [{ id: "ticket" }, { id: "atm" }]
            }
        };
    };

    const create = async (
        integracion: AuthenticatedIntegration,
        idempotencyKey: string | undefined,
        input: CreateOrderInput
    ) => {
        if (!idempotencyKey) {
            throw new PublicApiError(400, "validacion", "Falta el encabezado Idempotency-Key");
        }
        if (idempotencyKey.length > 200) {
            throw new PublicApiError(400, "validacion", "La clave de idempotencia es demasiado larga");
        }

        assertReturnUrlOrigin(input.urlRetorno, integracion.origen);
        const hash = hashBody(input);

        const existente = await orderRepository.findByIdempotency(integracion.id, idempotencyKey);
        if (existente) {
            if (existente.hash_idempotencia !== hash) {
                throw new PublicApiError(
                    409,
                    "idempotencia_conflicto",
                    "La misma clave de idempotencia se usó con otro cuerpo"
                );
            }

            await ensurePaymentLinkIfPending(existente);
            return { creado: false, pedido: await getPublicOrder(integracion.userId, existente) };
        }

        const libros = await quoteService.resolveBooks(integracion.userId, input.items);
        const subtotal = libros.reduce((total, libro) => total + libro.subtotal, 0);
        const { retiro, direccion, costoEnvio, pesoKg, caja } = await resolveDelivery(
            integracion.userId,
            input,
            libros
        );

        if (!(await mercadoPagoService.getConnection(integracion.userId))) {
            throw new PublicApiError(409, "mercadopago_no_conectado", "MercadoPago no está conectado");
        }

        const total = subtotal + costoEnvio;
        const venceEn = new Date(Date.now() + RESERVATION_DURATION_MS);
        const lockIdempotencia = `idem:${integracion.id}:${idempotencyKey}`;

        const resultado = await db.transaction(async (tx) => {
            // Serializa dos requests concurrentes con la misma clave antes de
            // tocar pedido, reserva o preferencia.
            await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lockIdempotencia}))`);

            const concurrente = await orderRepository.findByIdempotency(
                integracion.id,
                idempotencyKey,
                tx
            );
            if (concurrente) {
                if (concurrente.hash_idempotencia !== hash) {
                    throw new PublicApiError(
                        409,
                        "idempotencia_conflicto",
                        "La misma clave de idempotencia se usó con otro cuerpo"
                    );
                }
                return { creado: false as const, pedido: concurrente };
            }

            const codigo = await orderRepository.nextCode(integracion.userId, tx);
            const pedido = await orderRepository.insertOrder(
                {
                    user: integracion.userId,
                    integracion_id: integracion.id,
                    codigo,
                    referencia_externa: randomUUID(),
                    clave_idempotencia: idempotencyKey,
                    hash_idempotencia: hash,
                    comprador_nombre: input.comprador.nombre,
                    comprador_email: input.comprador.email,
                    comprador_telefono: input.comprador.telefono ?? null,
                    comprador_documento: input.comprador.documento ?? null,
                    entrega_tipo: input.entrega.tipo,
                    entrega_calle: direccion?.calle ?? null,
                    entrega_numero: direccion?.numero ?? null,
                    entrega_piso: direccion?.piso ?? null,
                    entrega_depto: direccion?.depto ?? null,
                    entrega_localidad: direccion?.localidad ?? null,
                    entrega_provincia: direccion?.provincia ?? null,
                    entrega_codigo_postal: direccion?.codigoPostal ?? null,
                    retiro_direccion: retiro?.direccion ?? null,
                    retiro_horario: retiro?.horario ?? null,
                    peso_kg: pesoKg,
                    caja_alto_cm: caja?.altoCm ?? null,
                    caja_ancho_cm: caja?.anchoCm ?? null,
                    caja_largo_cm: caja?.largoCm ?? null,
                    url_retorno: input.urlRetorno,
                    subtotal,
                    costo_envio: costoEnvio,
                    total
                },
                tx
            );

            await orderRepository.insertItems(
                pedido.id,
                integracion.userId,
                libros.map(({ libro, cantidad, subtotal: itemSubtotal }) => ({
                    idLibro: libro.id_libro,
                    isbn: libro.isbn,
                    titulo: libro.titulo,
                    precioUnitario: libro.precio,
                    cantidad,
                    subtotal: itemSubtotal
                })),
                tx
            );

            await availabilityService.reserve(
                pedido.id,
                libros.map(({ libro, cantidad }) => ({
                    id_libro: libro.id_libro,
                    isbn: libro.isbn,
                    titulo: libro.titulo,
                    cantidad
                })),
                integracion.userId,
                venceEn,
                tx
            );

            await orderRepository.insertHistory(
                pedido.id,
                integracion.userId,
                "pedido_creado",
                "Pedido creado y stock reservado",
                tx
            );

            return { creado: true as const, pedido };
        });

        // La preferencia se crea después del commit: con la llamada a MP dentro
        // de la transacción, un MP lento retenía los locks de stock de la
        // editorial. Si falla, reintentar con la misma Idempotency-Key la genera.
        if (resultado.creado) {
            await ensurePaymentLink(resultado.pedido, venceEn);
        } else {
            await ensurePaymentLinkIfPending(resultado.pedido);
        }

        return {
            creado: resultado.creado,
            pedido: await getPublicOrder(integracion.userId, resultado.pedido)
        };
    };

    const isReusableLink = (pago: Awaited<ReturnType<PaymentRepository["findLatestForOrder"]>>) =>
        pago?.estado === "pendiente" && pago.init_point && (!pago.vence_en || pago.vence_en > new Date());

    const createPaymentLink = async (pedido: OrderRow, venceEn: Date, tx: Tx) => {
        const conexion = await mercadoPagoService.getConnection(pedido.user);
        if (!conexion) {
            throw new PublicApiError(409, "mercadopago_no_conectado", "MercadoPago no está conectado");
        }
        const accessToken = await mercadoPagoService.getAccessToken(pedido.user);
        const items = await orderRepository.getItems(pedido.id, pedido.user, tx);

        const preferencia = await mercadoPagoClient
            .createPreference(
                accessToken,
                preferenceBody(
                    pedido,
                    items.map((item) => ({
                        isbn: item.isbn,
                        titulo: item.titulo,
                        cantidad: item.cantidad,
                        precioUnitario: item.precio_unitario
                    })),
                    conexion.mp_user_id,
                    pedido.url_retorno ?? "",
                    venceEn
                )
            )
            .catch(() => {
                throw new PublicApiError(502, "proveedor_no_disponible", "MercadoPago no pudo generar la preferencia");
            });

        await paymentRepository.insert(
            {
                user: pedido.user,
                pedido_id: pedido.id,
                proveedor: "mercadopago",
                preferencia_id: preferencia.id,
                init_point: preferencia.initPoint,
                estado: "pendiente",
                importe: pedido.total,
                moneda: "ARS",
                vence_en: venceEn
            },
            tx
        );

        return { preferenciaId: preferencia.id, initPoint: preferencia.initPoint, estado: "pendiente" as const };
    };

    // El lock por pedido evita que dos pedidos de link concurrentes creen dos
    // preferencias pagables para el mismo pedido.
    const ensurePaymentLink = (pedido: OrderRow, venceEn: Date) =>
        db.transaction(async (tx) => {
            const lock = `pago:${pedido.id}`;
            await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lock}))`);

            const ultimo = await paymentRepository.findLatestForOrder(pedido.id, pedido.user, tx);
            if (ultimo && isReusableLink(ultimo)) {
                return { preferenciaId: ultimo.preferencia_id, initPoint: ultimo.init_point, estado: ultimo.estado };
            }
            if (ultimo?.estado === "aprobado" || ultimo?.estado === "reembolsado") {
                throw new PublicApiError(409, "transicion_invalida", "El pedido ya tiene un pago aprobado");
            }

            return createPaymentLink(pedido, venceEn, tx);
        });

    const activeReservationExpiration = async (pedido: OrderRow): Promise<Date | null> => {
        if (pedido.estado !== "pendiente_pago") return null;
        const vencimiento = await orderRepository.getReservationExpiration(pedido.id, pedido.user);
        return vencimiento && vencimiento.getTime() > Date.now() ? vencimiento : null;
    };

    const ensurePaymentLinkIfPending = async (pedido: OrderRow) => {
        const vencimiento = await activeReservationExpiration(pedido);
        if (vencimiento) await ensurePaymentLink(pedido, vencimiento);
    };

    const regeneratePayment = async (userId: number, codigo: string, referencia: string | undefined) => {
        const pedido = await findBuyerOrder(userId, codigo, referencia);
        if (pedido.estado !== "pendiente_pago") {
            throw new PublicApiError(409, "transicion_invalida", "El pedido no está pendiente de pago");
        }

        const vencimiento = await activeReservationExpiration(pedido);
        if (!vencimiento) {
            throw new PublicApiError(409, "transicion_invalida", "El pedido ya expiró");
        }

        return ensurePaymentLink(pedido, vencimiento);
    };

    const getPublicPayment = async (userId: number, codigo: string, referencia: string | undefined) => {
        const pedido = await findBuyerOrder(userId, codigo, referencia);
        const pago = await paymentRepository.findLatestForOrder(pedido.id, userId);

        return toPaymentSummary(pago, pedido);
    };

    return {
        create,
        findBuyerOrder,
        getPublic,
        getPublicOrder,
        regeneratePayment,
        getPublicPayment
    };
}

export type CheckoutService = ReturnType<typeof createCheckoutService>;
