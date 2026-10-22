import { api } from "./client";
import type { MedioPago } from "./operaciones";

export type CreateMedioPagoInput = {
    nombre: string;
    comision?: number;
};

export type UpdateMedioPagoInput = {
    nombre?: string;
    comision?: number;
};

// `GET /medio_pago/` devuelve un array pelado (sin sobre `{success,data}`),
// mismo contrato que `GET /venta/medios_pago` que ya consumen los formularios
// de venta (ver back/src/modules/medioPago/medioPago.controller.ts).
export const listMediosPago = (): Promise<MedioPago[]> => api.get("/medio_pago");

export const createMedioPago = (input: CreateMedioPagoInput): Promise<{ success: true; data: MedioPago }> =>
    api.post("/medio_pago", input);

export const updateMedioPago = (id: number, input: UpdateMedioPagoInput): Promise<{ success: true; data: MedioPago }> =>
    api.put(`/medio_pago/${id}`, input);

// Baja lógica: el medio deja de listarse pero las ventas históricas lo siguen
// mostrando por su nombre (ver specs/010-medios-pago).
export const deleteMedioPago = (id: number): Promise<{ success: true }> => api.del(`/medio_pago/${id}`);
