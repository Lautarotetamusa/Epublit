// Formateo numérico compartido por los tableros: la misma cifra tiene que
// leerse igual en una tarjeta, un gráfico y una tabla (ver
// design-system/readme.md, "Números").
export const formatEntero = (value: number): string => value.toLocaleString("es-AR");

// Un decimal y sin ceros de más: "20,3%" y también "2%", no "2,0%".
export const formatPorcentaje = (value: number): string =>
    `${value.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
