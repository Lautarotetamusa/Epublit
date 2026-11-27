// Argentina no tiene horario de verano desde 2009, así que el desfase con UTC
// es fijo. Convertir mesa-de-reloj local ↔ instante UTC no necesita más que
// restar/sumar estas horas.
export const ZONA_HORARIA = "America/Argentina/Buenos_Aires";

const DESFASE_HORAS = -3;
const MS_POR_HORA = 60 * 60 * 1000;
export const MS_POR_DIA = 24 * MS_POR_HORA;

const formatoEnZona = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
});

export const conDosDigitos = (numero: number): string => String(numero).padStart(2, "0");

// Partes de la fecha (año/mes/día) tal como se leen en el calendario local.
export const partesEnZona = (fecha: Date): { anio: number; mes: number; dia: number } => {
    const partes = formatoEnZona.formatToParts(fecha);
    const valor = (tipo: "year" | "month" | "day"): number =>
        Number(partes.find((parte) => parte.type === tipo)!.value);

    return { anio: valor("year"), mes: valor("month"), dia: valor("day") };
};

export const partirMes = (mes: string): { anio: number; numero: number } => {
    const [anio, numero] = mes.split("-").map(Number);
    return { anio, numero };
};

export const fechaDeFecha = (fecha: Date): string => {
    const { anio, mes, dia } = partesEnZona(fecha);
    return `${anio}-${conDosDigitos(mes)}-${conDosDigitos(dia)}`;
};

export const mesDeFecha = (fecha: Date): string => {
    const { anio, mes } = partesEnZona(fecha);
    return `${anio}-${conDosDigitos(mes)}`;
};

export const diaDeFecha = (fecha: Date): number => partesEnZona(fecha).dia;

export const formatearDia = (mes: string, dia: number): string => {
    const { anio, numero } = partirMes(mes);
    return `${anio}-${conDosDigitos(numero)}-${conDosDigitos(dia)}`;
};

// Instante UTC del inicio (00:00) de un día local.
export const inicioDelDiaLocal = (mes: string, dia: number): Date => {
    const { anio, numero } = partirMes(mes);
    return new Date(Date.UTC(anio, numero - 1, dia) - DESFASE_HORAS * MS_POR_HORA);
};

export const finDelDiaLocal = (mes: string, dia: number): Date =>
    new Date(inicioDelDiaLocal(mes, dia).getTime() + MS_POR_DIA - 1);

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
