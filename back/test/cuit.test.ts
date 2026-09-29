import { describe, test, expect } from 'vitest';
import { isValidCuit } from '../src/lib/cuit';

// Unitario, sin HTTP ni DB: `isValidCuit` es una función pura.
describe('isValidCuit', () => {
    test('acepta CUITs con dígito verificador correcto', () => {
        expect(isValidCuit('27249804024')).toBe(true);
        expect(isValidCuit('20173080329')).toBe(true);
        expect(isValidCuit('20434919798')).toBe(true);
    });

    test('acepta el caso borde de resto 1 (tipo 30, verificador 9)', () => {
        expect(isValidCuit('30000000049')).toBe(true);
    });

    test('rechaza un dígito verificador incorrecto', () => {
        expect(isValidCuit('27249804025')).toBe(false);
        expect(isValidCuit('20173080320')).toBe(false);
    });

    test('rechaza formatos que no sean 11 dígitos', () => {
        expect(isValidCuit('2724980402')).toBe(false);
        expect(isValidCuit('272498040241')).toBe(false);
        expect(isValidCuit('27-24980402-4')).toBe(false);
        expect(isValidCuit('2724980402a')).toBe(false);
        expect(isValidCuit('')).toBe(false);
    });
});
