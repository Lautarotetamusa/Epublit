import { useState } from "react";
import { createPersona } from "../../api/persona";
import type { CreatePersonaInput, Persona, TipoPersona } from "../../api/persona";
import type { PersonaEnLibro } from "../../api/libro";

const toPersonaEnLibro = (persona: Persona, tipo: TipoPersona, porcentaje: number): PersonaEnLibro => ({
    id_persona: persona.id,
    nombre: persona.nombre,
    email: persona.email,
    dni: persona.dni,
    tipo,
    porcentaje
});

// Mismo shape de callbacks que expone `useFichaLibro` (agregar/actualizar/
// quitar), pero sin libro todavía: en el alta no hay isbn para pegarle a
// `/libro/:isbn/personas`, así que autores/ilustradores se juntan acá en
// memoria y se mandan en un solo batch después de crear el libro (ver
// NuevoLibroPage). Que comparta la interfaz es lo que permite reusar
// `PersonasLibroSection` sin tocarla.
export function usePersonasPendientes(personas: Persona[], onPersonaCreada: (persona: Persona) => void) {
    const [pendientes, setPendientes] = useState<PersonaEnLibro[]>([]);

    const agregarExistente = async (tipo: TipoPersona, idPersona: number, porcentaje: number) => {
        const persona = personas.find((p) => p.id === idPersona);
        if (!persona) return;
        setPendientes((current) => [...current, toPersonaEnLibro(persona, tipo, porcentaje)]);
    };

    const agregarNueva = async (tipo: TipoPersona, input: CreatePersonaInput, porcentaje: number) => {
        const creada = await createPersona(input);
        onPersonaCreada(creada.data);
        setPendientes((current) => [...current, toPersonaEnLibro(creada.data, tipo, porcentaje)]);
    };

    const actualizarPorcentaje = async (tipo: TipoPersona, idPersona: number, porcentaje: number) => {
        setPendientes((current) => current.map((p) => (p.id_persona === idPersona && p.tipo === tipo ? { ...p, porcentaje } : p)));
    };

    const quitar = async (tipo: TipoPersona, idPersona: number) => {
        setPendientes((current) => current.filter((p) => !(p.id_persona === idPersona && p.tipo === tipo)));
    };

    return { pendientes, agregarExistente, agregarNueva, actualizarPorcentaje, quitar };
}
