// Reglas fiscales compartidas por la emisión de comprobantes: qué letra
// corresponde según la condición frente al IVA del emisor y del receptor.

// Valores canónicos que ofrece el panel. Los datos existentes y los que trae
// el padrón de AFIP usan variantes ("RESPONSABLE INSCRIPTO", "IVA Responsable
// Inscripto"), por eso todas las comparaciones son normalizadas.
export const CONDICIONES_IVA = [
    "IVA Responsable Inscripto",
    "IVA Responsable no Inscripto",
    "IVA Exento",
    "Monotributo",
    "Consumidor Final",
    "Sujeto No Categorizado"
] as const;

export type CondicionIva = (typeof CONDICIONES_IVA)[number];

// Sin acentos ni mayúsculas: "IVA Exento" y "iva exento" son la misma
// condición.
export const normalizarCondicionFiscal = (condicion: string | null | undefined): string =>
    (condicion ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase();

export const esMonotributo = (condicion: string | null | undefined): boolean =>
    normalizarCondicionFiscal(condicion).includes("MONOTRIBUTO");

export const esExento = (condicion: string | null | undefined): boolean =>
    normalizarCondicionFiscal(condicion).includes("EXENTO");

export const esResponsableInscripto = (condicion: string | null | undefined): boolean => {
    const normalizada = normalizarCondicionFiscal(condicion);

    return normalizada.includes("RESPONSABLE INSCRIPTO") && !normalizada.includes("NO INSCRIPTO");
};

// Códigos AFIP de tipo de comprobante usados por Epublit.
export const FACTURA_A = 1;
export const FACTURA_B = 6;
export const FACTURA_C = 11;

// Emisor monotributista o exento (o con una condición que no es RI) emite
// siempre C: no discrimina IVA. Un emisor RI emite A a otro responsable
// inscripto y B al resto (consumidor final, monotributo, exento).
export function tipoComprobanteFiscal(
    condicionEmisor: string | null | undefined,
    condicionReceptor: string | null | undefined
): typeof FACTURA_A | typeof FACTURA_B | typeof FACTURA_C {
    if (!esResponsableInscripto(condicionEmisor)) return FACTURA_C;

    return esResponsableInscripto(condicionReceptor) ? FACTURA_A : FACTURA_B;
}

// Sólo A y B discriminan IVA. La C (monotributo/exento) no lo liquida.
export const discriminaIva = (tipoComprobante: number): boolean =>
    tipoComprobante === FACTURA_A || tipoComprobante === FACTURA_B;
