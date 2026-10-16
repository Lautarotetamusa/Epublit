// Formateo compartido por el gráfico y la tabla del ranking: si cada uno
// formateara por su cuenta, el mismo número podría leerse distinto en las dos
// partes de la misma pantalla (ver la regla de DRY de front/CLAUDE.md).

export const formatEntero = (value: number): string => value.toLocaleString("es-AR");

// Un decimal y sin ceros de más: "20,3%" y también "2%", no "2,0%".
export const formatPorcentaje = (value: number): string =>
    `${value.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;

// El sufijo del oficio va acá y no en cada pantalla: en una editorial se cuenta
// en ejemplares, no en unidades (ver design-system/readme.md, "Números").
export const formatEjemplares = (value: number): string => `${formatEntero(value)} ej.`;
