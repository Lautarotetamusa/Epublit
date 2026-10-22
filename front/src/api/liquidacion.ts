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

// Ventas del período que una liquidación anterior ya cubrió: el reporte las
// informa agrupadas por liquidación, con la cantidad de movimientos que quedaron
// afuera (ver back liquidaciones.repository.ts#getExcluidas). Como el backend ya
// las excluye de `libros`/`personas`, esto sólo alimenta el aviso de la pantalla.
export type Excluida = {
    liquidacion_id: number;
    codigo: string;
    ventas: number;
};

// A diferencia de otros recursos, `desde`/`hasta` no viven acá: son el
// input con el que se pidió la liquidación, no parte de la respuesta del
// backend (ver back/src/modules/liquidacion/liquidacion.service.ts).
export type Liquidacion = {
    libros: LibroLiquidado[];
    personas: PersonaLiquidada[];
    total_facturado: number;
    ejemplares_vendidos: number;
    excluidas: Excluida[];
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
