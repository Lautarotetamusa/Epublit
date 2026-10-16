import { useState } from "react";
import { createPersona } from "../../api/persona";
import type { CreatePersonaInput, Persona } from "../../api/persona";
import type { Rol } from "../../api/rol";
import type { PersonaEnLibro } from "../../api/libro";

const toPersonaEnLibro = (persona: Persona, rol: Rol, porcentaje: number): PersonaEnLibro => ({
    id_persona: persona.id,
    nombre: persona.nombre,
    email: persona.email,
    dni: persona.dni,
    rol,
    porcentaje
});

// Mismo shape de callbacks que expone `useFichaLibro` (agregar/actualizar/
// quitar), pero sin libro todavía: en el alta no hay isbn para pegarle a
// `/libro/:isbn/personas`, así que las personas y sus roles se juntan acá en
// memoria y se mandan en un solo batch después de crear el libro (ver
// NuevoLibroPage). Que comparta la interfaz es lo que permite reusar
// `PersonasLibroSection` sin tocarla.
export function usePersonasPendientes(personas: Persona[], onPersonaCreada: (persona: Persona) => void) {
    const [pendientes, setPendientes] = useState<PersonaEnLibro[]>([]);

    const agregarExistente = async (rol: Rol, idPersona: number, porcentaje: number) => {
        const persona = personas.find((p) => p.id === idPersona);
        if (!persona) return;
        setPendientes((current) => [...current, toPersonaEnLibro(persona, rol, porcentaje)]);
    };

    const agregarNueva = async (rol: Rol, input: CreatePersonaInput, porcentaje: number) => {
        const creada = await createPersona(input);
        onPersonaCreada(creada.data);
        setPendientes((current) => [...current, toPersonaEnLibro(creada.data, rol, porcentaje)]);
    };

    const actualizarPorcentaje = async (rol: Rol, idPersona: number, porcentaje: number) => {
        setPendientes((current) =>
            current.map((p) => (p.id_persona === idPersona && p.rol.id === rol.id ? { ...p, porcentaje } : p))
        );
    };

    const quitar = async (rol: Rol, idPersona: number) => {
        setPendientes((current) => current.filter((p) => !(p.id_persona === idPersona && p.rol.id === rol.id)));
    };

    return { pendientes, agregarExistente, agregarNueva, actualizarPorcentaje, quitar };
}
