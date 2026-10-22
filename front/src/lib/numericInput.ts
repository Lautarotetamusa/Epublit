// `<input type="number">` deja pasar caracteres no numéricos vía pegado
// ("12abc" pegado deja el input vacío) o notación como "e"/"+"/"-" tipeada a
// mano; filtrar el string antes de guardarlo en el estado es lo que
// garantiza que sólo queden dígitos, sin depender del comportamiento nativo
// del input en cada navegador.
export function sanitizeInteger(value: string): string {
    return value.replace(/[^0-9]/g, "");
}

export function sanitizeDecimal(value: string): string {
    const [integerPart, ...decimalParts] = value.replace(/[^0-9.]/g, "").split(".");
    return decimalParts.length > 0 ? `${integerPart}.${decimalParts.join("")}` : integerPart;
}

// Recorta un valor numérico a [min, max] al perder foco: se deja escribir
// libre mientras se tipea (sanitizeDecimal ya filtra caracteres inválidos) y
// recién acá se fuerza el rango, para no pelearle al usuario mientras borra
// o reescribe un número de varios dígitos.
export function clampRange(value: string, min: number, max: number): string {
    if (value === "") return value;
    const num = Number(value);
    if (Number.isNaN(num)) return value;
    return String(Math.min(max, Math.max(min, num)));
}
