import { z } from "zod";
import { MAX_ITEMS_POR_PEDIDO, quoteItemSchema } from "../shipping/quote.validator";

const comprador = z
    .object({
        nombre: z.string().trim().min(1).max(160),
        email: z.string().trim().email().max(255),
        telefono: z.string().trim().max(40).optional(),
        documento: z.string().trim().max(40).optional()
    })
    .strict();

const direccion = z
    .object({
        calle: z.string().trim().min(1).max(160),
        numero: z.string().trim().min(1).max(20),
        piso: z.string().trim().max(20).optional(),
        depto: z.string().trim().max(20).optional(),
        localidad: z.string().trim().min(1).max(120),
        provincia: z.string().trim().min(1).max(120),
        codigoPostal: z.string().trim().min(1).max(12)
    })
    .strict();

const entrega = z.discriminatedUnion("tipo", [
    z.object({ tipo: z.literal("envio"), direccion }).strict(),
    z.object({ tipo: z.literal("retiro") }).strict()
]);

export const createOrderSchema = z
    .object({
        comprador,
        entrega,
        items: z.array(quoteItemSchema).min(1).max(MAX_ITEMS_POR_PEDIDO),
        urlRetorno: z.string().trim().url().max(500)
    })
    .strict();

export const orderCodeSchema = z.string().trim().min(1).max(30);

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type BuyerInput = z.infer<typeof comprador>;
export type AddressInput = z.infer<typeof direccion>;
