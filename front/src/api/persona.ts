import { api, toQueryString } from "./client";
import type { ListEnvelope } from "./client";

export type TipoPersona = "autor" | "ilustrador";

// Refleja back/src/modules/persona/persona.schema.ts. `tipo` NO es un campo
// de la persona: es un atributo de su relación con un libro puntual (ver
// libroPersona.ts) — una misma persona puede ser autora de un libro e
// ilustradora de otro.
export type Persona = {
    id: number;
    dni: string;
    nombre: string;
    email: string | null;
    // Campos nuevos (ver specs/004-persona-foto-bio/design.md — sección
    // "Datos necesarios"): todavía no existen en el backend, así que el
    // cliente los trata como opcionales.
    fotoUrl: string | null;
    bio: string | null;
};

export type CreatePersonaInput = {
    dni: string;
    nombre: string;
    email?: string;
    bio?: string;
};

export type UpdatePersonaInput = Partial<CreatePersonaInput>;

// `tipo` filtra por el tipo con el que esa persona participó en ALGÚN
// libro (ver back/src/modules/persona/persona.controller.ts#getAll +
// service.getAllByTipo) — sigue sin ser un campo propio de la persona.
export const listPersonas = (params: { tipo?: TipoPersona; page?: number; pageSize?: number } = {}): Promise<ListEnvelope<Persona>> =>
    api.get(`/persona${toQueryString(params)}`);

export const getPersona = (id: number): Promise<{ success: true; data: Persona }> => api.get(`/persona/${id}`);

export const createPersona = (input: CreatePersonaInput): Promise<{ success: true; data: Persona }> => api.post("/persona", input);

export const updatePersona = (id: number, input: UpdatePersonaInput): Promise<{ success: true; data: Persona }> =>
    api.put(`/persona/${id}`, input);

export const deletePersona = (id: number): Promise<{ success: true }> => api.del(`/persona/${id}`);
