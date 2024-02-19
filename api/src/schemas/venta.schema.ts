import {z} from 'zod';
import { libroCantidad } from "./libros.schema";

export const medioPago = {
    efectivo: 0,
    debito: 1,
    credito: 2,
    mercadopago: 3,
    transferencia: 4
} as const;
export type MedioPago = keyof typeof medioPago;

const ventaSchema = z.object({
    id: z.number(),
    fecha: z.date(),
    descuento: z.number().max(100).default(0),
    medio_pago: z.enum(Object.keys(medioPago) as [MedioPago]),
    id_cliente: z.number(),
    total: z.number(),
    file_path: z.string()
});
export type VentaSchema = z.infer<typeof ventaSchema>;

export const createVenta = ventaSchema.pick({
    descuento: true,
    medio_pago: true
}).and(z.object({
    libros: libroCantidad.array(),
    cliente: z.number()
}));
export type CreateVenta = z.infer<typeof createVenta>;

const saveVenta = ventaSchema.omit({
    id: true,
    fecha: true
});
export type SaveVenta = z.infer<typeof saveVenta>;
