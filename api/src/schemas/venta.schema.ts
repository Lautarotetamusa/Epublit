import {z} from 'zod';
import { libroCantidad } from "./libros.schema";

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
    id: z.number(),
    fecha: z.date(),
    descuento: z.number().max(100).default(0),
    medio_pago: z.enum(Object.keys(medioPago) as [MedioPago]),
    id_cliente: z.number(),
    total: z.number(),
    file_path: z.string(),
    user: z.number(),
    tipo_cbte: z.number().refine((val) => val in tiposComprobantes, {
        message: "El tipo de comprobante no es valido"
    })
});
export type VentaSchema = z.infer<typeof ventaSchema>;

export const createVenta = ventaSchema.pick({
    descuento: true,
    medio_pago: true,
    tipo_cbte: true,
}).and(z.object({
    libros: libroCantidad.array().transform(items => { //Si un libro esta dos veces se suman las cantidades

        let isbns: Record<string, number> = {};
        for (const item of items){
            if (item.isbn in isbns){
                isbns[item.isbn] += item.cantidad;
            }else{
                isbns[item.isbn] = item.cantidad;
            }
        }
        return Object.keys(isbns).map(i => ({isbn: i, cantidad: isbns[i]}));
    }),
    cliente: z.number()
}));
export type CreateVenta = z.infer<typeof createVenta>;

const saveVenta = ventaSchema.omit({
    id: true,
    fecha: true
});
export type SaveVenta = z.infer<typeof saveVenta>;
