import {z} from 'zod';
import { libroCantidad } from "./libros.schema";

const consignacionSchema = z.object({
   id: z.number(),
   id_cliente: z.number(),
   fecha: z.date(),
   remito_path: z.string()
});
export type ConsignacionSchema = z.infer<typeof consignacionSchema>;

export type SaveConsignacion = Omit<ConsignacionSchema, 'fecha' | 'id'>; 

export const createConsignacion = z.object({
    cliente: z.number(),
    libros: libroCantidad.array()
});
export type CreateConsignacion = z.infer<typeof createConsignacion>;
