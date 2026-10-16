// El neto de una venta se deriva (no se persiste, ver
// specs/010-medios-pago/plan.md): total menos la comisión congelada al vender.
// Vive en `lib/` y no en un módulo porque lo consumen tanto `transaccion`
// (listado/ficha) como `movimiento` (detalle con venta), y esos módulos no
// pueden importarse entre sí sin crear un ciclo (transaccion ya depende del
// repository de movimiento).
export function calcularNeto(total: number, comision: number): number {
    return parseFloat((total - (comision / 100) * total).toFixed(2));
}
