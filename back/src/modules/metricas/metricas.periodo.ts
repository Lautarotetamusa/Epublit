// El panel piensa por mes calendario en hora local de Argentina: decide a qué
// mes pertenece cada movimiento y cuál es el «hoy» del tramo en curso. El resto
// del sistema corta los días en UTC (ver liquidacion.service.ts) porque ahí la
// unidad es el instante; acá la unidad es el mes de la editorial, que empieza y
// termina en la zona de la cuenta.

export const ZONA_HORARIA = "America/Argentina/Buenos_Aires";

// Argentina no tiene horario de verano desde 2009, así que el desfase con UTC
// es fijo. Convertir mesa-de-reloj local ↔ instante UTC no necesita más que
// restar/sumar estas horas.
const DESFASE_HORAS = -3;
const MS_POR_HORA = 60 * 60 * 1000;
const MS_POR_DIA = 24 * MS_POR_HORA;

const formatoEnZona = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
});

const conDosDigitos = (numero: number): string => String(numero).padStart(2, "0");

// Partes de la fecha (año/mes/día) tal como se leen en el calendario local.
const partesEnZona = (fecha: Date): { anio: number; mes: number; dia: number } => {
    const partes = formatoEnZona.formatToParts(fecha);
    const valor = (tipo: "year" | "month" | "day"): number =>
        Number(partes.find((parte) => parte.type === tipo)!.value);

    return { anio: valor("year"), mes: valor("month"), dia: valor("day") };
};

const partirMes = (mes: string): { anio: number; numero: number } => {
    const [anio, numero] = mes.split("-").map(Number);
    return { anio, numero };
};

const formatearDia = (mes: string, dia: number): string => {
    const { anio, numero } = partirMes(mes);
    return `${anio}-${conDosDigitos(numero)}-${conDosDigitos(dia)}`;
};

// Instante UTC del inicio (00:00) de un día local.
const inicioDelDiaLocal = (mes: string, dia: number): Date => {
    const { anio, numero } = partirMes(mes);
    return new Date(Date.UTC(anio, numero - 1, dia) - DESFASE_HORAS * MS_POR_HORA);
};

const finDelDiaLocal = (mes: string, dia: number): Date =>
    new Date(inicioDelDiaLocal(mes, dia).getTime() + MS_POR_DIA - 1);

export const mesDeFecha = (fecha: Date): string => {
    const { anio, mes } = partesEnZona(fecha);
    return `${anio}-${conDosDigitos(mes)}`;
};

export const diaDeFecha = (fecha: Date): number => partesEnZona(fecha).dia;

export const mesAnterior = (mes: string): string => {
    const { anio, numero } = partirMes(mes);
    return numero === 1 ? `${anio - 1}-12` : `${anio}-${conDosDigitos(numero - 1)}`;
};

// Los `cantidad` meses que terminan en `mes`, del más viejo al más nuevo.
export const ultimosMeses = (mes: string, cantidad: number): string[] => {
    const meses: string[] = [mes];
    for (let i = 1; i < cantidad; i++) meses.push(mesAnterior(meses[i - 1]));

    return meses.reverse();
};

export const ultimoDiaDelMes = (mes: string): number => {
    const { anio, numero } = partirMes(mes);
    return new Date(Date.UTC(anio, numero, 0)).getUTCDate();
};

// Instante UTC del inicio (00:00 local) del mes.
export const inicioDelMes = (mes: string): Date => inicioDelDiaLocal(mes, 1);

export type Tramo = {
    mes: string;
    desde: string; // YYYY-MM-DD local, inclusivo
    hasta: string; // YYYY-MM-DD local, inclusivo
    desdeInstante: Date; // límite inferior inclusivo (UTC)
    hastaInstante: Date; // límite superior inclusivo (UTC)
};

export type ResolucionPeriodo = {
    periodo: Tramo;
    enCurso: boolean;
    comparacion: Tramo;
    comparacionParcial: boolean;
};

const tramo = (mes: string, hastaDia: number): Tramo => ({
    mes,
    desde: formatearDia(mes, 1),
    hasta: formatearDia(mes, hastaDia),
    desdeInstante: inicioDelDiaLocal(mes, 1),
    hastaInstante: finDelDiaLocal(mes, hastaDia)
});

// Un mes ya cerrado va completo y se compara contra el mes anterior completo.
// El mes en curso está a medias, así que se corta en el día de hoy y se compara
// contra el mismo tramo de días del mes anterior (hasta su último día si el
// anterior es más corto).
export const resolverPeriodo = (mes: string, ahora: Date): ResolucionPeriodo => {
    const enCurso = mes === mesDeFecha(ahora);
    const diaDeHoy = diaDeFecha(ahora);

    const anterior = mesAnterior(mes);
    const ultimoDiaAnterior = ultimoDiaDelMes(anterior);
    const ultimoDiaPeriodo = enCurso ? diaDeHoy : ultimoDiaDelMes(mes);
    const ultimoDiaComparado = enCurso ? Math.min(diaDeHoy, ultimoDiaAnterior) : ultimoDiaAnterior;

    return {
        periodo: tramo(mes, ultimoDiaPeriodo),
        enCurso,
        comparacion: tramo(anterior, ultimoDiaComparado),
        comparacionParcial: enCurso
    };
};
