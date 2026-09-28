import type { TipoPersona } from "../../api/persona";

export type RolFiltro = TipoPersona | "todos";

// Opciones del filtro de rol del listado único de personas (ver
// design.md 005-unificar-personas): "rol" filtra por el tipo de
// participación en algún libro, no es un campo propio de la persona.
export const ROL_FILTRO_OPTIONS: Array<{ value: RolFiltro; label: string }> = [
    { value: "todos", label: "Todos" },
    { value: "autor", label: "Autores" },
    { value: "ilustrador", label: "Ilustradores" }
];
