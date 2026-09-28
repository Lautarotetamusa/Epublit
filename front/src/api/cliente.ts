import { api, toQueryString } from "./client";
import type { ListEnvelope } from "./client";

export type TipoCliente = "inscripto" | "particular" | "negro";

// Refleja back/src/modules/cliente/cliente.schema.ts.
export type Cliente = {
    id: number;
    nombre: string;
    email: string | null;
    cuit: string | null;
    cond_fiscal: string;
    razon_social: string;
    domicilio: string;
    tipo: TipoCliente | null;
};

export type CreateClienteInput = {
    nombre: string;
    email?: string;
    cuit: string;
};

export type UpdateClienteInput = Partial<CreateClienteInput>;

export type StockCliente = {
    id_libro: number;
    isbn: string;
    titulo: string;
    precio: number;
    stock: number;
};

export const listClientes = (params: { tipo?: TipoCliente } = {}): Promise<ListEnvelope<Cliente>> =>
    api.get(`/cliente${toQueryString(params)}`);

export const getCliente = (id: number): Promise<{ success: true; data: Cliente }> => api.get(`/cliente/${id}`);

export const createCliente = (input: CreateClienteInput): Promise<{ success: true; data: Cliente }> => api.post("/cliente", input);

export const updateCliente = (id: number, input: UpdateClienteInput): Promise<{ success: true; data: Cliente }> =>
    api.put(`/cliente/${id}`, input);

export const deleteCliente = (id: number): Promise<{ success: true }> => api.del(`/cliente/${id}`);

export const getStockCliente = (id: number): Promise<{ success: true; data: StockCliente[] }> => api.get(`/cliente/${id}/stock`);

// `GET /cliente/:id/ventas` no está migrado en el backend (devuelve 501,
// ver back/src/modules/cliente/cliente.controller.ts#getVentas): no hay
// función acá para eso a propósito, no es un olvido.
export const syncPreciosCliente = (id: number): Promise<{ success: true; data: StockCliente[] }> => api.put(`/cliente/${id}/stock`);
