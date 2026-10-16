import type { Rol } from "../../api/rol";

export type TonoRol = "brand" | "accent" | "neutral";

// El nombre del rol es un dato de la cuenta, no del sistema: se muestra tal
// como se cargó, sólo con la inicial en mayúscula para que caiga en la misma
// voz que el resto de la interfaz (casing de sentencia, ver
// design-system/readme.md).
export const nombreVisible = (nombre: string): string =>
    nombre === "" ? nombre : nombre[0].toUpperCase() + nombre.slice(1);

// El tono del badge es presentación, no dato: los dos roles por defecto de la
// cuenta (los que el plan crea primero: autor e ilustrador) conservan los tonos
// que ya tenían en las tablas —pino y violeta— y del tercero en adelante pasa a
// neutro, en vez de inventar semántica de color donde no la hay.
export const tonoDeRol = (rol: Rol): TonoRol => {
    if (rol.id === 1) return "brand";
    if (rol.id === 2) return "accent";
    return "neutral";
};

// Opciones de un `Select` de roles: el valor es el id, que es lo que identifica
// al rol en toda la API (ver specs/011-roles/plan.md).
export const opcionesDeRol = (roles: Rol[]): Array<{ value: string; label: string }> =>
    roles.map((rol) => ({ value: String(rol.id), label: nombreVisible(rol.nombre) }));
