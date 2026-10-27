import { createHash } from "crypto";
import { StockInsuficiente } from "../../../lib/http/errors";
import type { LibroConColeccion, LibroService } from "../../libro";
import type { AvailabilityService } from "../stock/availability.service";
import type { ShippingConfigService, ShippingOperation } from "./shippingConfig.service";
import type { MicorreoClient, MicorreoToken } from "./clients/micorreo.client";
import { mergeItems } from "./quote.validator";
import type { QuoteInput } from "./quote.validator";

export type QuoteServiceDeps = {
    libroService: Pick<LibroService, "findOne">;
    availabilityService: Pick<AvailabilityService, "getAvailability">;
    shippingConfigService: Pick<ShippingConfigService, "getOperation">;
    micorreoClient: MicorreoClient;
};

export type CartBook = {
    libro: LibroConColeccion;
    cantidad: number;
    subtotal: number;
};

export type CalculatedShipping =
    | {
          disponible: true;
          costo: number;
          plazo: string;
          pesoGramos: number;
          pesoKg: number;
          caja: { altoCm: number; anchoCm: number; largoCm: number };
      }
    | {
          disponible: false;
          motivo: "peso_faltante" | "correo_no_configurado" | "proveedor_no_disponible" | "retiro_seleccionado";
          mensaje: string;
      };

const REASONS = {
    peso_faltante: "Falta el peso de uno o más libros y la cuenta no tiene peso promedio configurado",
    correo_no_configurado: "Falta configurar MiCorreo y PAQ.AR en la cuenta",
    proveedor_no_disponible: "El correo no pudo cotizar el envío en este momento",
    retiro_seleccionado: "El pedido es con retiro en local"
} as const;

export function createQuoteService({
    libroService,
    availabilityService,
    shippingConfigService,
    micorreoClient
}: QuoteServiceDeps) {
    const tokenCache = new Map<string, MicorreoToken>();

    const tokenKey = (config: NonNullable<ShippingOperation["micorreo"]>) =>
        createHash("sha256").update(`${config.usuario}:${config.password}`).digest("hex");

    const getToken = async (config: NonNullable<ShippingOperation["micorreo"]>): Promise<string> => {
        const key = tokenKey(config);
        const cacheado = tokenCache.get(key);
        if (cacheado && cacheado.expiresAt.getTime() > Date.now() + 30_000) return cacheado.token;

        const token = await micorreoClient.getToken({ usuario: config.usuario, password: config.password });
        tokenCache.set(key, token);
        return token.token;
    };

    const resolveBooks = async (userId: number, items: QuoteInput["items"]): Promise<CartBook[]> => {
        const fusionados = mergeItems(items);

        const libros = await Promise.all(
            fusionados.map(async (item) => {
                const libro = await libroService.findOne(item.isbn, userId);
                return { libro, cantidad: item.cantidad, subtotal: libro.precio * item.cantidad };
            })
        );

        const disponibilidad = await availabilityService.getAvailability(
            libros.map(({ libro, cantidad }) => ({
                id_libro: libro.id_libro,
                isbn: libro.isbn,
                titulo: libro.titulo,
                cantidad
            })),
            userId
        );

        const missingStock = libros
            .filter(({ libro, cantidad }) => {
                const actual = disponibilidad.find((d) => d.id_libro === libro.id_libro);
                return (actual?.disponibleParaVenta ?? 0) < cantidad;
            })
            .map(({ libro, cantidad }) => {
                const actual = disponibilidad.find((d) => d.id_libro === libro.id_libro);
                return {
                    isbn: libro.isbn,
                    titulo: libro.titulo,
                    pedido: cantidad,
                    disponible: actual?.disponibleParaVenta ?? 0
                };
            });

        if (missingStock.length > 0) {
            throw new StockInsuficiente("No hay stock suficiente para la operación", missingStock);
        }

        return libros;
    };

    const calculateShipping = async (
        userId: number,
        libros: CartBook[],
        codigoPostalDestino: string
    ): Promise<CalculatedShipping> => {
        const config = await shippingConfigService.getOperation(userId);

        if (!config.micorreo || !config.paqar || !config.origen.codigoPostal) {
            return {
                disponible: false,
                motivo: "correo_no_configurado",
                mensaje: REASONS.correo_no_configurado
            };
        }

        let pesoGramos = 0;
        for (const { libro, cantidad } of libros) {
            const peso = libro.peso_kg ?? config.pesoPromedioKg;
            if (peso === null || peso === undefined) {
                return { disponible: false, motivo: "peso_faltante", mensaje: REASONS.peso_faltante };
            }
            pesoGramos += peso * cantidad * 1000;
        }

        try {
            const token = await getToken(config.micorreo);
            const [rate] = await micorreoClient.getRates(token, {
                customerId: config.micorreo.customerId,
                postalCodeOrigin: config.origen.codigoPostal,
                postalCodeDestination: codigoPostalDestino,
                deliveredType: "D",
                dimensions: {
                    weight: Math.ceil(pesoGramos),
                    height: config.cajaDefault.altoCm,
                    width: config.cajaDefault.anchoCm,
                    length: config.cajaDefault.largoCm
                }
            });

            if (!rate) {
                return {
                    disponible: false,
                    motivo: "proveedor_no_disponible",
                    mensaje: REASONS.proveedor_no_disponible
                };
            }

            return {
                disponible: true,
                costo: rate.costo,
                plazo: rate.plazo,
                pesoGramos: Math.ceil(pesoGramos),
                pesoKg: Math.round(pesoGramos) / 1000,
                caja: config.cajaDefault
            };
        } catch {
            return {
                disponible: false,
                motivo: "proveedor_no_disponible",
                mensaje: REASONS.proveedor_no_disponible
            };
        }
    };

    const isPickupAvailable = async (userId: number) => {
        const config = await shippingConfigService.getOperation(userId);
        if (!config.retiro.activo) return { disponible: false as const };

        return {
            disponible: true as const,
            direccion: config.retiro.direccion,
            horario: config.retiro.horario
        };
    };

    const quote = async (userId: number, input: QuoteInput) => {
        const libros = await resolveBooks(userId, input.items);
        const subtotal = libros.reduce((total, item) => total + item.subtotal, 0);
        const retiro = await isPickupAvailable(userId);

        let envio: CalculatedShipping;
        if (input.entrega.tipo === "envio") {
            envio = await calculateShipping(userId, libros, input.entrega.codigoPostal);
        } else {
            envio = {
                disponible: false,
                motivo: "retiro_seleccionado",
                mensaje: REASONS.retiro_seleccionado
            };
        }

        let envioPublico;
        if (envio.disponible) {
            envioPublico = { disponible: true, costo: envio.costo, plazo: envio.plazo };
        } else {
            envioPublico = { disponible: false, motivo: envio.motivo, mensaje: envio.mensaje };
        }

        return {
            subtotal,
            items: libros.map(({ libro, cantidad, subtotal: itemSubtotal }) => ({
                isbn: libro.isbn,
                titulo: libro.titulo,
                cantidad,
                precioUnitario: libro.precio,
                subtotal: itemSubtotal
            })),
            envio: envioPublico,
            retiro
        };
    };

    return {
        quote,
        resolveBooks,
        calculateShipping,
        isPickupAvailable
    };
}

export type QuoteService = ReturnType<typeof createQuoteService>;
