import { api } from "./client";
import type { Rol } from "./rol";

// La terna libro + persona + rol es la que no se puede repetir: el rol de la
// cuenta viaja por id (ver specs/011-roles/plan.md, "Asignación de personas a
// un libro").
export type LibroPersonaInput = {
    id_persona: number;
    rol: Rol;
    porcentaje: number;
};

export type LibroPersonaRemoveInput = {
    id_persona: number;
    rol: Rol;
};

const comoBody = ({ id_persona, rol, porcentaje }: LibroPersonaInput) => ({
    id_persona,
    rol: rol.id,
    porcentaje
});

export const addLibroPersonas = async (isbn: string, items: LibroPersonaInput[]): Promise<void> => {
    await api.post(`/libro/${isbn}/personas`, items.map(comoBody));
};

export const updateLibroPersonas = async (isbn: string, items: LibroPersonaInput[]): Promise<void> => {
    await api.put(`/libro/${isbn}/personas`, items.map(comoBody));
};

export const removeLibroPersonas = async (isbn: string, items: LibroPersonaRemoveInput[]): Promise<void> => {
    await api.del(
        `/libro/${isbn}/personas`,
        items.map(({ id_persona, rol }) => ({ id_persona, rol: rol.id }))
    );
};
