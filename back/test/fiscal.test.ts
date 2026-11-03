import { describe, expect, test } from "vitest";
import { tipoComprobanteFiscal, FACTURA_A, FACTURA_B, FACTURA_C } from "../src/lib/afip/fiscal";
import { importesFiscales } from "../src/lib/afip/Afip";

describe("tipo de comprobante según condición frente al IVA", () => {
    test("un emisor monotributista emite siempre C, sin importar el receptor", () => {
        expect(tipoComprobanteFiscal("Monotributo", "IVA Responsable Inscripto")).toBe(FACTURA_C);
        expect(tipoComprobanteFiscal("Monotributo", "Consumidor Final")).toBe(FACTURA_C);
    });

    test("un emisor exento emite C", () => {
        expect(tipoComprobanteFiscal("IVA Exento", "IVA Responsable Inscripto")).toBe(FACTURA_C);
        expect(tipoComprobanteFiscal("IVA EXENTO", "CONSUMIDOR FINAL")).toBe(FACTURA_C);
    });

    test("un emisor responsable inscripto emite A a otro inscripto y B al resto", () => {
        expect(tipoComprobanteFiscal("IVA Responsable Inscripto", "IVA Responsable Inscripto")).toBe(FACTURA_A);
        expect(tipoComprobanteFiscal("RESPONSABLE INSCRIPTO", "RESPONSABLE INSCRIPTO")).toBe(FACTURA_A);
        expect(tipoComprobanteFiscal("IVA Responsable Inscripto", "Consumidor Final")).toBe(FACTURA_B);
        expect(tipoComprobanteFiscal("IVA Responsable Inscripto", "Monotributo")).toBe(FACTURA_B);
        expect(tipoComprobanteFiscal("IVA Responsable Inscripto", "IVA Exento")).toBe(FACTURA_B);
    });

    test("una condición desconocida o vacía no habilita A/B", () => {
        expect(tipoComprobanteFiscal("", "IVA Responsable Inscripto")).toBe(FACTURA_C);
        expect(tipoComprobanteFiscal(" - ", "Consumidor Final")).toBe(FACTURA_C);
    });
});

describe("importes fiscales", () => {
    test("A y B discriminan IVA incluido en el precio", () => {
        const importes = importesFiscales({ tipo_cbte: FACTURA_B, total: 1210, descuento: 0 });

        expect(importes).toMatchObject({ neto: 1000, iva: 210, exento: 0, total: 1210 });
    });

    test("C no discrimina IVA", () => {
        const importes = importesFiscales({ tipo_cbte: FACTURA_C, total: 1210, descuento: 0 });

        expect(importes).toMatchObject({ neto: 1210, iva: 0, exento: 0, total: 1210 });
    });
});
