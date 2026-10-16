import { api } from "./client";

// El rol es una entidad de la cuenta: nombre editable y baja lógica (ver
// specs/011-roles/plan.md, "Diseño de API"). Una persona trabaja en un libro
// con un rol, y "autor"/"ilustrador" dejan de ser un enum fijo para ser dos
// roles más, creados por defecto en toda cuenta.
export type Rol = { id: number; nombre: string };

export type CreateRolInput = { nombre: string };
export type UpdateRolInput = { nombre: string };

// `GET /rol` devuelve el array pelado de roles activos, sin sobre
// `{ success, data }`: mismo contrato que `GET /medio_pago`.
export const listRoles = (): Promise<Rol[]> => api.get<Rol[]>("/rol");

// Alta y renombre usan el sobre estándar del proyecto: el rol vive en `data`.
export const createRol = (input: CreateRolInput): Promise<Rol> =>
    api.post<{ success: true; data: Rol }>("/rol", input).then((res) => res.data);

export const updateRol = (id: number, input: UpdateRolInput): Promise<Rol> =>
    api.put<{ success: true; data: Rol }>(`/rol/${id}`, input).then((res) => res.data);

// Baja lógica: el rol deja de ofrecerse al asignar personas, pero no se pierde
// (plan 011, tarea 7).
export const deleteRol = (id: number): Promise<void> => api.del<void>(`/rol/${id}`);
