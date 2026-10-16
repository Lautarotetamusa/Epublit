import { api, toQueryString } from "./client";
import type { ListEnvelope } from "./client";
import type { Rol } from "./rol";

// Refleja back/src/modules/persona/persona.schema.ts. El rol de una persona NO
// es un campo suyo: es un atributo de su relación con un libro puntual (ver
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

// Un libro en el que participa la persona, con el rol de la cuenta con el que
// participa (plan 011, tarea 12). Renombrar el rol cambia lo que devuelve esta
// lectura sin tocar la relación.
export type LibroDePersona = {
    isbn: string;
    titulo: string;
    rol: Rol;
};

export type PersonaConLibros = Persona & { libros: LibroDePersona[] };

export type CreatePersonaInput = {
    dni: string;
    nombre: string;
    email?: string;
    bio?: string;
};

export type UpdatePersonaInput = Partial<CreatePersonaInput>;

export type ListPersonasParams = {
    // Filtra por el rol de la cuenta con el que la persona participó en algún
    // libro (plan 011, tarea 10). Sin filtro, devuelve todas las personas,
    // incluidas las que no trabajan en ningún libro.
    rol?: Rol;
    page?: number;
    pageSize?: number;
};

export const listPersonas = (params: ListPersonasParams = {}): Promise<ListEnvelope<Persona>> => {
    const { rol, page = 1, pageSize = 10 } = params;

    return api.get(`/persona${toQueryString({ rol: rol?.id, page, pageSize })}`);
};

export const getPersona = (id: number): Promise<{ success: true; data: PersonaConLibros }> => api.get(`/persona/${id}`);

export const createPersona = (input: CreatePersonaInput): Promise<{ success: true; data: Persona }> => api.post("/persona", input);

export const updatePersona = (id: number, input: UpdatePersonaInput): Promise<{ success: true; data: Persona }> =>
    api.put(`/persona/${id}`, input);

export const deletePersona = (id: number): Promise<{ success: true }> => api.del(`/persona/${id}`);
