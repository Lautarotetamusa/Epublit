import { api } from "./client";

// El tipo de edición es una entidad de la cuenta: nombre editable y baja
// lógica (mismo patrón que roles). Un libro referencia el tipo de su cuenta, y
// "Normal", "Pop up" y "Cartoné" se crean por defecto en toda cuenta.
export type TipoEdicion = { id: number; nombre: string };

export type CreateTipoEdicionInput = { nombre: string };
export type UpdateTipoEdicionInput = { nombre: string };

// `GET /tipo_edicion` devuelve el array pelado de tipos activos, sin sobre
// `{ success, data }`: mismo contrato que `GET /rol`.
export const listTiposEdicion = (): Promise<TipoEdicion[]> => api.get<TipoEdicion[]>("/tipo_edicion");

// Alta y renombre usan el sobre estándar del proyecto: el tipo vive en `data`.
export const createTipoEdicion = (input: CreateTipoEdicionInput): Promise<TipoEdicion> =>
    api.post<{ success: true; data: TipoEdicion }>("/tipo_edicion", input).then((res) => res.data);

export const updateTipoEdicion = (id: number, input: UpdateTipoEdicionInput): Promise<TipoEdicion> =>
    api.put<{ success: true; data: TipoEdicion }>(`/tipo_edicion/${id}`, input).then((res) => res.data);

// Baja lógica: el tipo deja de ofrecerse al cargar un libro, pero los libros
// que ya lo usaban siguen mostrando su nombre.
export const deleteTipoEdicion = (id: number): Promise<void> => api.del<void>(`/tipo_edicion/${id}`);
