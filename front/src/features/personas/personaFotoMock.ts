// La foto de una persona todavía no tiene forma de guardarse de verdad (no
// hay endpoint ni columna en el backend, ver "Datos necesarios" en
// specs/004-persona-foto-bio/design.md): esto simula esa persistencia en
// memoria para que la ficha se pueda probar de punta a punta. Es una
// decisión temporal de este mock, no una propuesta de cómo se sube/guarda
// la foto — eso lo decide el planner.
const fotoPorPersona = new Map<number, string>();

export function getFotoMock(id: number): string | null {
    return fotoPorPersona.get(id) ?? null;
}

export function setFotoMock(id: number, url: string): void {
    fotoPorPersona.set(id, url);
}

export function removeFotoMock(id: number): void {
    fotoPorPersona.delete(id);
}
