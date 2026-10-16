import { api, toQueryString } from "./client";
import type { Rol } from "./rol";

// Refleja back/src/modules/liquidacion/liquidacion.service.ts.
export type LibroLiquidado = {
    id_libro: number;
    isbn: string;
    titulo: string;
    cantidad_vendida: number;
    precio_unitario: number;
    importe_total: number;
};

// El rol de la cuenta con el que esa persona participa del libro (plan 011):
// todos los roles de la cuenta, no sólo `autor` e `ilustrador`. Va por línea de
// detalle y no a nivel persona: una misma persona puede participar de un libro
// con un rol y de otro con otro (o del mismo libro con dos roles).
export type PersonaLiquidacionDetalle = {
    id_libro: number;
    titulo: string;
    rol: Rol;
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

// Cada línea de `detalle` ya trae el rol de la cuenta como `{ id, nombre }`
// (ver back/src/modules/liquidacion/liquidacion.service.ts): la liquidación
// incluye todos los roles, no sólo los fijos.
export const generarLiquidacion = (input: GenerarLiquidacionInput): Promise<{ success: true; data: Liquidacion }> =>
    api.get(`/liquidacion${toQueryString(input)}`);
