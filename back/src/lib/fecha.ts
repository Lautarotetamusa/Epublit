const MS_POR_DIA = 24 * 60 * 60 * 1000;

// Un filtro `hasta` llega como fecha "pelada" (00:00:00 del día), pero tiene
// que ser inclusive: se corre al último milisegundo de ese mismo día antes de
// compararla contra un timestamp completo.
export const finDelDia = (fecha: Date): Date => new Date(fecha.getTime() + MS_POR_DIA - 1);

// Normaliza una fecha que puede llegar como `Date` (lo que devuelve el driver
// para una columna `date`) o como string a `YYYY-MM-DD`.
export const aFechaISO = (fecha: Date | string): string => (fecha instanceof Date ? fecha.toISOString() : fecha).slice(0, 10);

