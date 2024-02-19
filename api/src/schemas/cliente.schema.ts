import {z} from 'zod';

export const tipoCliente = {
    particular: 0,
    inscripto: 1,
    negro: 2
}
export type TipoCliente = keyof typeof tipoCliente;

const clienteSchema = z.object({
    cond_fiscal: z.string(),
    razon_social: z.string(),
    domicilio: z.string(),
    nombre: z.string(),
    email: z.string().optional(),
    cuit: z.string(),
    tipo: z.enum(Object.keys(tipoCliente)as [TipoCliente]),
    id: z.number()
});
export type ClienteSchema = z.infer<typeof clienteSchema>;

export const afipSchema = clienteSchema.pick({
    cond_fiscal: true,
    razon_social: true,
    domicilio: true
});
export type AfipData = z.infer<typeof afipSchema>;

const saveClienteInscripto = clienteSchema.omit({id: true});
export type SaveClienteInscripto = z.infer<typeof saveClienteInscripto>; 

export const updateCliente = saveClienteInscripto.partial();
export type UpdateCliente = z.infer<typeof updateCliente>;

export const createCliente = clienteSchema.pick({
    nombre: true,
    email: true,
    cuit: true,
    tipo: true
});
export type CreateCliente = z.infer<typeof createCliente>;

export type StockCliente = {
    cantidad: number, 
    isbn: string
}[]
