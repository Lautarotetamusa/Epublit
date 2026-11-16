import type { TipoEdicion } from "../../api/libro";

// Textos de la ficha del libro: la interfaz nunca muestra los campos crudos
// (null, números sueltos) sino el dato tal como se lee en el catálogo.

// "0 a 3 años", "+8 años", "Hasta 3 años" o "—" si no hay dato.
export function rangoDeEdad(edadMin: number | null, edadMax: number | null): string {
    if (edadMin === null && edadMax === null) return "—";
    if (edadMin === null) return `Hasta ${edadMax} años`;
    if (edadMax === null) return `+${edadMin} años`;
    if (edadMin === edadMax) return `${edadMin} años`;

    return `${edadMin} a ${edadMax} años`;
}

// "20 × 15 × 2 cm" con las medidas cargadas; "—" si no hay ninguna.
export function medidasDeLibro(libro: { alto: number | null; ancho: number | null; largo: number | null }): string {
    const medidas = [libro.alto, libro.ancho, libro.largo].filter((medida): medida is number => medida !== null);

    return medidas.length > 0 ? `${medidas.join(" × ")} cm` : "—";
}

export function pesoDeLibro(pesoKg: number | null): string {
    return pesoKg === null ? "—" : `${pesoKg.toLocaleString("es-AR")} kg`;
}

// Orden fijo (no alfabético): «Normal» es el caso habitual y va primero.
export const TIPOS_EDICION: { value: TipoEdicion; label: string }[] = [
    { value: "normal", label: "Normal" },
    { value: "pop_up", label: "Pop up" },
    { value: "cartone", label: "Cartoné" }
];

export function etiquetaTipoEdicion(tipo: TipoEdicion): string {
    return TIPOS_EDICION.find((opcion) => opcion.value === tipo)?.label ?? tipo;
}
