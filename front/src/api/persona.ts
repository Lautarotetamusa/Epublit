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
    // La API devuelve `foto_url` (snake_case); la UI usa `fotoUrl`.
    fotoUrl: string | null;
    bio: string | null;
};

// El backend sigue la convención snake_case del resto de la API. El mapeo se
// hace acá, en el borde, para que los componentes no conozcan el detalle.
type PersonaApi = Omit<Persona, "fotoUrl"> & { foto_url: string | null };

// Un libro en el que participa la persona, con el rol de la cuenta con el que
// participa (plan 011, tarea 12). Renombrar el rol cambia lo que devuelve esta
// lectura sin tocar la relación.
export type LibroDePersona = {
    isbn: string;
    titulo: string;
    rol: Rol;
};

export type PersonaConLibros = Persona & { libros: LibroDePersona[] };

type PersonaConLibrosApi = PersonaApi & { libros: LibroDePersona[] };

const toPersona = (persona: PersonaApi): Persona => {
    const { foto_url, ...rest } = persona;
    return { ...rest, fotoUrl: foto_url };
};

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

export const listPersonas = async (params: ListPersonasParams = {}): Promise<ListEnvelope<Persona>> => {
    const { rol, page = 1, pageSize = 10 } = params;
    const response = await api.get<ListEnvelope<PersonaApi>>(
        `/persona${toQueryString({ rol: rol?.id, page, pageSize })}`
    );

    return { ...response, items: response.items.map(toPersona) };
};

export const getPersona = async (id: number): Promise<{ success: true; data: PersonaConLibros }> => {
    const response = await api.get<{ success: true; data: PersonaConLibrosApi }>(`/persona/${id}`);
    const { foto_url, ...rest } = response.data;

    return { ...response, data: { ...rest, fotoUrl: foto_url } };
};

export const createPersona = async (input: CreatePersonaInput): Promise<{ success: true; data: Persona }> => {
    const response = await api.post<{ success: true; data: PersonaApi }>("/persona", input);

    return { ...response, data: toPersona(response.data) };
};

export const updatePersona = async (id: number, input: UpdatePersonaInput): Promise<{ success: true; data: Persona }> => {
    const response = await api.put<{ success: true; data: PersonaApi }>(`/persona/${id}`, input);

    return { ...response, data: toPersona(response.data) };
};

export const deletePersona = (id: number): Promise<{ success: true }> => api.del(`/persona/${id}`);

// La foto se sube/reemplaza en un endpoint aparte, igual que la portada de un
// libro: la persona tiene que existir antes. El backend valida tipo, tamaño y
// resolución según la configuración de la cuenta.
export const uploadPersonaFoto = async (id: number, file: File): Promise<{ success: true; data: Persona }> => {
    const response = await api.postFile<{ success: true; data: PersonaApi }>(`/persona/${id}/foto`, "foto", file);

    return { ...response, data: toPersona(response.data) };
};

// Idempotente del lado del backend: si la persona no tenía foto, igual responde
// 200 con `foto_url` en null.
export const removePersonaFoto = async (id: number): Promise<{ success: true; data: Persona }> => {
    const response = await api.del<{ success: true; data: PersonaApi }>(`/persona/${id}/foto`);

    return { ...response, data: toPersona(response.data) };
};
