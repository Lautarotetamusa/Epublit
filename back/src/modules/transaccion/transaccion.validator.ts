import { z } from "zod";
import { libroCantidad } from "../libro/libro.validator";

export const tipoTransaccion = {
    venta: "venta",
    consignacion: "consignacion",
    devolucion: "devolucion",
    ventaConsignacion: "ventaConsignacion",
} as const;
export type TipoTransaccion = keyof typeof tipoTransaccion;

// Body de `consignacion`/`devolucion`: libros + cliente. Los datos de venta los
// agrega `createVenta`/`createVentaConsignado` (venta.validator.ts).
export const createTransaccion = z.object({
    // Sin `.min(1)` un array vacío pasaba la validación y explotaba más abajo
    // (un insert con cero filas). Si un libro está dos veces, se suman las
    // cantidades.
    libros: libroCantidad.array().min(1, "Tenés que incluir al menos un libro").transform(items => {
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
