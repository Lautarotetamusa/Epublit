import { api, toQueryString } from "./client";
import type { ListEnvelope } from "./client";

// Refleja back/src/modules/coleccion/coleccion.service.ts#PublicColeccion.
// Nombres reales de la API: `id` (no `id_coleccion`) y `cantidad_libros` (no
// `libros_count`).
export type Coleccion = {
    id: number;
    titulo: string;
    descripcion: string | null;
    portada_url: string | null;
    cantidad_libros: number;
};

// Shape de cada libro en `GET /coleccion/:id/libros`: el backend devuelve sólo
// lo que muestra la tabla (ver `ColeccionLibro` en el service), no un libro
// completo.
export type ColeccionLibro = {
    isbn: string;
    titulo: string;
    precio: number;
    portada_url: string | null;
};

export type CreateColeccionInput = {
    titulo: string;
    descripcion?: string | null;
};

// En la edición el backend también exige título (`PUT /coleccion/:id`).
export type UpdateColeccionInput = CreateColeccionInput;

// `GET /coleccion/` no está paginado: devuelve todas las colecciones del
// usuario dentro de `data`.
export const listColecciones = (): Promise<{ success: true; data: Coleccion[] }> => api.get("/coleccion");

export const getColeccion = (id: number): Promise<{ success: true; data: Coleccion }> => api.get(`/coleccion/${id}`);

export const createColeccion = (input: CreateColeccionInput): Promise<{ success: true; data: Coleccion }> =>
    api.post("/coleccion", input);

export const updateColeccion = (id: number, input: UpdateColeccionInput): Promise<{ success: true; data: Coleccion }> =>
    api.put(`/coleccion/${id}`, input);

// 204 sin body: no hay sobre `{ success }` que leer (ver plan, "Diseño de API").
export const deleteColeccion = (id: number): Promise<void> => api.del<void>(`/coleccion/${id}`);

// Esta lectura sí viene paginada con la convención `{ pagination, items }`.
export const listLibrosDeColeccion = (
    id: number,
    params: { page?: number; pageSize?: number } = {}
): Promise<ListEnvelope<ColeccionLibro>> => api.get(`/coleccion/${id}/libros${toQueryString(params)}`);

// Portada: multipart, endpoint separado (mismo patrón que la portada de
// libro). La colección tiene que existir antes de subirle una imagen, así que
// se sube en un segundo paso (ver specs/007-colecciones).
export const uploadColeccionPortada = (id: number, file: File): Promise<{ success: true; data: Coleccion }> =>
    api.postFile(`/coleccion/${id}/portada`, "portada", file);

// Idempotente del lado del backend: si la colección no tenía portada, igual
// responde 200 con `portada_url` en null.
export const removeColeccionPortada = (id: number): Promise<{ success: true; data: Coleccion }> =>
    api.del(`/coleccion/${id}/portada`);
