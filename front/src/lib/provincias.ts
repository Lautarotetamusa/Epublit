// El backend y PAQ.AR/MiCorreo usan el código de provincia de AFIP (una
// letra); la pantalla muestra el nombre. Guardar el nombre en vez del código
// haría que la etiqueta salga con un estado inválido.
export const PROVINCIAS_ARGENTINA = [
    { value: "C", label: "CABA" },
    { value: "B", label: "Buenos Aires" },
    { value: "K", label: "Catamarca" },
    { value: "H", label: "Chaco" },
    { value: "U", label: "Chubut" },
    { value: "X", label: "Córdoba" },
    { value: "W", label: "Corrientes" },
    { value: "E", label: "Entre Ríos" },
    { value: "P", label: "Formosa" },
    { value: "Y", label: "Jujuy" },
    { value: "L", label: "La Pampa" },
    { value: "F", label: "La Rioja" },
    { value: "M", label: "Mendoza" },
    { value: "N", label: "Misiones" },
    { value: "Q", label: "Neuquén" },
    { value: "R", label: "Río Negro" },
    { value: "A", label: "Salta" },
    { value: "J", label: "San Juan" },
    { value: "D", label: "San Luis" },
    { value: "Z", label: "Santa Cruz" },
    { value: "S", label: "Santa Fe" },
    { value: "G", label: "Santiago del Estero" },
    { value: "V", label: "Tierra del Fuego" },
    { value: "T", label: "Tucumán" }
];

// Compatibilidad con configuraciones guardadas antes de usar códigos: si
// llega el nombre, se traduce al código; si ya es un código, se conserva.
export function normalizarProvincia(valor: string | null): string {
    if (!valor) return "";

    const porCodigo = PROVINCIAS_ARGENTINA.find((provincia) => provincia.value === valor);
    if (porCodigo) return porCodigo.value;

    return PROVINCIAS_ARGENTINA.find((provincia) => provincia.label === valor)?.value ?? valor;
}

// Para mostrar en la ficha: el pedido guarda el código de AFIP, pero el
// comprador y el admin leen el nombre.
export function provinciaLabel(valor: string | null): string {
    if (!valor) return "";

    return PROVINCIAS_ARGENTINA.find(
        (provincia) => provincia.value === valor || provincia.label === valor
    )?.label ?? valor;
}
