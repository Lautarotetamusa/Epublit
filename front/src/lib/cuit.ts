const CUIT_LENGTH = 11;
const CHECK_DIGIT_WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

// Se pega desde el padrón, un mail o una factura con guiones, espacios o
// puntos: el valor que importa son sólo los dígitos, y nunca más de 11 (un
// `maxLength` sobre el texto crudo cortaría el CUIT pegado con guiones antes
// de limpiarlo).
export function normalizeCuit(value: string): string {
    return value.replace(/\D/g, "").slice(0, CUIT_LENGTH);
}

// Sólo con los 11 dígitos: formatear a medio tipear mueve el cursor en cada
// guion que aparece.
export function formatCuit(digits: string): string {
    if (digits.length !== CUIT_LENGTH) return digits;
    return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}

// Módulo 11 de ARCA. Un resto que da 10 no tiene dígito posible: ARCA en ese
// caso cambia el prefijo (20/27 → 23), así que un CUIT así no existe.
export function hasValidCuitCheckDigit(digits: string): boolean {
    if (!/^\d{11}$/.test(digits)) return false;

    const sum = CHECK_DIGIT_WEIGHTS.reduce((total, weight, index) => total + weight * Number(digits[index]), 0);
    const expected = 11 - (sum % 11);
    const checkDigit = expected === 11 ? 0 : expected;

    return expected !== 10 && checkDigit === Number(digits[10]);
}

export function getCuitError(digits: string): string | null {
    if (digits === "") return "Ingresá el CUIT de la editorial.";
    if (digits.length < CUIT_LENGTH) {
        const missing = CUIT_LENGTH - digits.length;
        return `El CUIT tiene 11 dígitos: ${missing === 1 ? "falta 1" : `faltan ${missing}`}.`;
    }
    if (!hasValidCuitCheckDigit(digits)) return "Este CUIT no es válido. Revisá que esté bien copiado.";
    return null;
}
