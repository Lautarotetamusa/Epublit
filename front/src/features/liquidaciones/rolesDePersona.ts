import type { PersonaLiquidada } from "../../api/liquidacion";
import type { Rol } from "../../api/rol";

// Los roles distintos presentes en el detalle de una persona: puede ser autora
// de un libro y traductora de otro (o traductora y correctora del mismo) dentro
// del período liquidado. Se deduplican por id y se conserva el orden en el que
// aparecen las líneas de detalle.
export function rolesDePersona(persona: PersonaLiquidada): Rol[] {
    const roles = new Map<number, Rol>();

    for (const linea of persona.detalle) roles.set(linea.rol.id, linea.rol);

    return [...roles.values()];
}
