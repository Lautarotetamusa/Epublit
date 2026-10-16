// Formateo de fechas es-AR compartido (`dd/mm/yyyy`, ver
// design-system/readme.md#fundamentos-de-contenido, "Números"). El backend
// manda fechas ISO (`YYYY-MM-DD`); la interfaz nunca las muestra crudas.
export function formatFecha(iso: string): string {
    return new Date(`${iso}T00:00:00`).toLocaleDateString("es-AR");
}

// Rango de un período, con guion medio: "01/06/2026 – 30/06/2026".
export function formatRango(desde: string, hasta: string): string {
    return `${formatFecha(desde)} – ${formatFecha(hasta)}`;
}

// Un mes se representa con `yyyy-mm`, que es la unidad de período del panel de
// Inicio (mes completo) y el prefijo de las fechas ISO que manda el backend.
function aMes(fecha: Date): string {
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
}

// El panel de Inicio trabaja por **mes completo**, así que un período se
// representa con el mes y no con un par de fechas. Estos helpers son el único
// lugar donde se hace la aritmética de meses.

export function mesActual(): string {
    return aMes(new Date());
}

// El día del mes de hoy (1–31): hasta dónde llega el mes en curso, y por lo tanto
// el corte que se le aplica al mes anterior para comparar la misma cantidad de
// días transcurridos y no un tramo contra un mes entero.
export function diaDeHoy(): number {
    return new Date().getDate();
}

export function mesAnterior(mes: string): string {
    const [anio, numeroDeMes] = mes.split("-").map(Number);
    // Día 1 del mes anterior: `numeroDeMes - 2` porque el mes de Date va de 0 a 11.
    return aMes(new Date(anio, numeroDeMes - 2, 1));
}

// Los `cantidad` meses que terminan en `mes`, del más viejo al más nuevo: es la
// ventana de la evolución mensual del panel.
export function ultimosMeses(mes: string, cantidad: number): string[] {
    const [anio, numeroDeMes] = mes.split("-").map(Number);
    return Array.from({ length: cantidad }, (_, indice) => aMes(new Date(anio, numeroDeMes - cantidad + indice, 1)));
}

export function formatMes(mes: string): string {
    const [anio, numeroDeMes] = mes.split("-").map(Number);
    return new Date(anio, numeroDeMes - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

// El mes solo, sin el año, cuando es el mismo año que el mes de referencia:
// "un 35% menos que en septiembre" se lee mejor que "...que en septiembre de
// 2026" al lado de una cifra que ya dice de qué año habla. Si cambia el año, el
// año vuelve (si no, "diciembre" no se entiende).
export function formatMesCorto(mes: string, mesDeReferencia: string): string {
    if (mes.slice(0, 4) !== mesDeReferencia.slice(0, 4)) return formatMes(mes);
    const [anio, numeroDeMes] = mes.split("-").map(Number);
    return new Date(anio, numeroDeMes - 1, 1).toLocaleDateString("es-AR", { month: "long" });
}
