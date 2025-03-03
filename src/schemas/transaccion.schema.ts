import {z} from 'zod';
import { libroCantidad } from "./libros.schema";

export const tipoTransaccion = {
    venta: "venta",
    consignacion: "consignacion",
    devolucion: "devolucion",
    ventaConsignacion: "ventaConsignacion",
} as const;
export type TipoTransaccion = keyof typeof tipoTransaccion;
const tipoTransaccionKeys = Object.keys(tipoTransaccion) as [TipoTransaccion];

export const transaccionSchema = z.object({
    id: z.number(),
    id_cliente: z.number(),
    type: z.enum(tipoTransaccionKeys),
    fecha: z.date(),
    file_path: z.string(),
    user: z.number(),
});
export type TransaccionSchema = z.infer<typeof transaccionSchema>;

const saveTransaccion = transaccionSchema.omit({
    id: true,
    fecha: true
});
export type SaveTransaccion = z.infer<typeof saveTransaccion>;

export const createTransaccion = z.object({
    libros: libroCantidad.array().transform(items => { //Si un libro esta dos veces se suman las cantidades
        const isbns: Record<string, number> = {};
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
});
export type CreateTransaccion = z.infer<typeof createTransaccion>;
