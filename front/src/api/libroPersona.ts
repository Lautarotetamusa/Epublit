import { api } from "./client";
import type { Rol } from "./rol";

// La terna libro + persona + rol es la que no se puede repetir: el rol de la
// cuenta viaja por id (ver specs/011-roles/plan.md, "Asignación de personas a
// un libro").
export type LibroPersonaInput = {
    id_persona: number;
    rol: Rol;
    porcentaje: number;
    // Monto acordado del anticipo (opcional): el backend lo copia como snapshot
    // al generarse el anticipo al lanzar el libro. Omitirlo en el PUT deja el
    // anticipo actual sin tocar y en el POST no genera anticipo para esa
    // relación (ver specs/012-liquidaciones-pagos).
    monto_acordado?: number;
};

export type LibroPersonaRemoveInput = {
    id_persona: number;
    rol: Rol;
};

const comoBody = ({ id_persona, rol, porcentaje, monto_acordado }: LibroPersonaInput) => ({
    id_persona,
    rol: rol.id,
    porcentaje,
    // `undefined` no lo serializa JSON.stringify: el PUT sólo toca el anticipo
    // cuando el valor viene con número.
    monto_acordado
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
