import {z} from 'zod';
import { afipSchema } from './afip.schema';

export const tipoCliente = {
    particular: "particular",
    inscripto: "inscripto",
    negro: "negro"
} as const;
export type TipoCliente = keyof typeof tipoCliente;

const baseSchema = z.object({
    cuit: z.string(),
    nombre: z.string(),
    email: z.string().optional(),
    tipo: z.enum(Object.keys(tipoCliente)as [TipoCliente]),
    id: z.number(),
    user: z.number(),
});

const clienteSchema = afipSchema.pick({
    cond_fiscal: true,
    razon_social: true,
    domicilio: true
}).and(baseSchema);

export type ClienteSchema = z.infer<typeof clienteSchema>;

export type SaveClienteInscripto = Omit<ClienteSchema, 'id'>; 

export const updateCliente = baseSchema.omit({id: true, user: true}).partial(); 
export type UpdateCliente = Partial<Omit<ClienteSchema, 'id' | 'user'>>;

export const createCliente = baseSchema.pick({
    nombre: true,
    email: true,
    cuit: true,
    tipo: true
});
export type CreateCliente = z.infer<typeof createCliente>;

export type LibroClienteSchema = {
    id_libro: number,
    titulo: string,
    precio: number,
    stock: number, 
    isbn: string,
};

export type StockCliente = {
    cantidad: number, 
    id_libro: number,
    isbn: string,
}[];
