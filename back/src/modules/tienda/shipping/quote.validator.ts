import { z } from "zod";

// Topes de un carrito de librería: frenan pedidos que reserven todo el stock
// de un título de una sola vez.
export const MAX_CANTIDAD_POR_ITEM = 100;
export const MAX_ITEMS_POR_PEDIDO = 50;

export const quoteItemSchema = z
    .object({
        isbn: z.string().trim().min(1).max(13),
        cantidad: z.number().int().positive().max(MAX_CANTIDAD_POR_ITEM)
    })
    .strict();

const shippingAddressSchema = z
    .object({
        tipo: z.literal("envio"),
        codigoPostal: z.string().trim().min(1).max(12),
        localidad: z.string().trim().min(1).max(120),
        provincia: z.string().trim().min(1).max(120)
    })
    .strict();

const retiro = z.object({ tipo: z.literal("retiro") }).strict();

export const quoteSchema = z
    .object({
        items: z.array(quoteItemSchema).min(1).max(MAX_ITEMS_POR_PEDIDO),
        entrega: z.discriminatedUnion("tipo", [shippingAddressSchema, retiro])
    })
    .strict();

export type QuoteInput = z.infer<typeof quoteSchema>;
export type QuoteItem = z.infer<typeof quoteItemSchema>;

export function mergeItems(items: QuoteItem[]): QuoteItem[] {
    const cantidades = new Map<string, number>();
    for (const item of items) {
        cantidades.set(item.isbn, (cantidades.get(item.isbn) ?? 0) + item.cantidad);
    }

    return [...cantidades.entries()].map(([isbn, cantidad]) => ({ isbn, cantidad }));
}
