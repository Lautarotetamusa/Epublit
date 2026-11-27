const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// Etiqueta corta del eje mensual de la serie ("2026-11" → "nov"). El backend
// manda el mes como `YYYY-MM`.
export function etiquetaMes(mes: string): string {
    const numeroDeMes = Number(mes.slice(5, 7));
    return MESES_CORTOS[numeroDeMes - 1] ?? mes;
}
