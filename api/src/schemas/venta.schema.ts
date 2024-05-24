import {z} from 'zod';
import { createTransaccion } from './transaccion.schema';

export const medioPago = {
    efectivo: "efectivo",
    debito: "debito",
    credito: "credito",
    mercadopago: "mercadopago",
    transferencia: "transferencia"
} as const;
export type MedioPago = keyof typeof medioPago;

export const tiposComprobantes = {
    1: {
        cod: 'A',
        descripcion: "Factura A"
    },
    6: {
        cod: 'B',
        descripcion: "Factura B"
    },
    11: {
        cod: 'C',
        descripcion: "Factura C"
    },
    51: {
        cod: 'M',
        descripction: "Factura M"
    }
} as const;

const ventaSchema = z.object({
    id_transaccion: z.number(),
    descuento: z.number().max(100).default(0),
    medio_pago: z.enum(Object.keys(medioPago) as [MedioPago]),
    total: z.number(),
    tipo_cbte: z.number().refine((val) => val in tiposComprobantes, {
        message: "El tipo de comprobante no es valido"
    })
});
export type VentaSchema = z.infer<typeof ventaSchema>;

export const createVenta = ventaSchema.pick({
    descuento: true,
    medio_pago: true,
    tipo_cbte: true,
}).and(createTransaccion);
export type CreateVenta = z.infer<typeof createVenta>;

const saveVenta = ventaSchema;
export type SaveVenta = z.infer<typeof saveVenta>;
