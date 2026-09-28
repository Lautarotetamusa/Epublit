import { api, toQueryString } from "./client";

// Refleja back/src/modules/liquidacion/liquidacion.service.ts.
export type LibroLiquidado = {
    id_libro: number;
    isbn: string;
    titulo: string;
    cantidad_vendida: number;
    precio_unitario: number;
    importe_total: number;
};

export type TipoPersonaLiquidacion = "autor" | "ilustrador";

// El backend pone `tipo` por línea de detalle, no a nivel persona: una misma
// persona puede ser autora de un libro e ilustradora de otro en el mismo período.
export type PersonaLiquidacionDetalle = {
    id_libro: number;
    titulo: string;
    tipo: TipoPersonaLiquidacion;
    porcentaje: number;
    importe: number;
};

export type PersonaLiquidada = {
    id_persona: number;
    nombre: string;
    detalle: PersonaLiquidacionDetalle[];
    total_a_pagar: number;
};

// A diferencia de otros recursos, `desde`/`hasta` no viven acá: son el
// input con el que se pidió la liquidación, no parte de la respuesta del
// backend (ver back/src/modules/liquidacion/liquidacion.service.ts).
export type Liquidacion = {
    libros: LibroLiquidado[];
    personas: PersonaLiquidada[];
    total_facturado: number;
    ejemplares_vendidos: number;
};

export type GenerarLiquidacionInput = {
    desde: string;
    hasta: string;
};

export const generarLiquidacion = (input: GenerarLiquidacionInput): Promise<{ success: true; data: Liquidacion }> =>
    api.get(`/liquidacion${toQueryString(input)}`);
