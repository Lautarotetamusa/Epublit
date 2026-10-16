// Formato es-AR con símbolo, compartido por todas las pantallas que muestran
// importes (ver front/src/design-system/readme.md#fundamentos-de-contenido,
// "Números"). Los importes con centavos se muestran con dos decimales
// ($ 362,50) y los redondos sin ninguno ($ 4.600): un "$ 362,5" a mitad de
// camino no es plata que se lea bien.
export const formatMoney = (value: number): string =>
    `$ ${value.toLocaleString("es-AR", {
        minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
        maximumFractionDigits: 2
    })}`;
