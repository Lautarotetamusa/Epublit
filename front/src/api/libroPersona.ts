import { api } from "./client";
import type { TipoPersona } from "./persona";

// Refleja back/src/modules/libro/libroPersona.validator.ts. `POST/PUT/DELETE
// /libro/:isbn/personas` aceptan un objeto o un array (acá siempre se manda
// array, más simple del lado del cliente).
export type LibroPersonaInput = {
    id_persona: number;
    tipo: TipoPersona;
    porcentaje: number;
};

export type LibroPersonaRemoveInput = {
    id_persona: number;
    tipo: TipoPersona;
};

export const addLibroPersonas = (isbn: string, items: LibroPersonaInput[]) => api.post(`/libro/${isbn}/personas`, items);

export const updateLibroPersonas = (isbn: string, items: LibroPersonaInput[]) => api.put(`/libro/${isbn}/personas`, items);

export const removeLibroPersonas = (isbn: string, items: LibroPersonaRemoveInput[]) => api.del(`/libro/${isbn}/personas`, items);
