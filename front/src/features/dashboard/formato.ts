// Formateo compartido por el gráfico y la tabla del ranking: si cada uno
// formateara por su cuenta, el mismo número podría leerse distinto en las dos
// partes de la misma pantalla (ver la regla de DRY de front/CLAUDE.md).
import { formatEntero } from "../../lib/numero";

export { formatEntero, formatPorcentaje } from "../../lib/numero";

// El sufijo del oficio va acá y no en cada pantalla: en una editorial se cuenta
// en ejemplares, no en unidades (ver design-system/readme.md, "Números").
export const formatEjemplares = (value: number): string => `${formatEntero(value)} ej.`;
