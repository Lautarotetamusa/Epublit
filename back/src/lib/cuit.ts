// Pesos del algoritmo módulo 11 para el dígito verificador del CUIT.
const CUIT_WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

const CUIT_REGEX = /^\d{11}$/;

const cuitCheckDigit = (firstTenDigits: string): number => {
    const weightedSum = [...firstTenDigits].reduce(
        (sum, digit, index) => sum + Number(digit) * CUIT_WEIGHTS[index],
        0
    );
    const remainder = weightedSum % 11;

    // Resto 0 -> 0 y resto 1 -> 9 (el 11-resto daría 11 y 10, que no son
    // un dígito válido; ver el caso de tipos 23/33).
    if (remainder === 0) return 0;
    if (remainder === 1) return 9;

    return 11 - remainder;
};

export const isValidCuit = (value: string): boolean =>
    CUIT_REGEX.test(value) && cuitCheckDigit(value.slice(0, 10)) === Number(value[10]);
