// El panel piensa por mes calendario en hora local de Argentina: decide a qué
// mes pertenece cada movimiento y cuál es el «hoy» del tramo en curso. El resto
// del sistema corta los días en UTC (ver liquidacion.service.ts) porque ahí la
// unidad es el instante; acá la unidad es el mes de la editorial, que empieza y
// termina en la zona de la cuenta.

import {
    diaDeFecha,
    finDelDiaLocal,
    formatearDia,
    inicioDelDiaLocal,
    inicioDelMes,
    mesAnterior,
    mesDeFecha,
    ultimoDiaDelMes,
    ultimosMeses,
    ZONA_HORARIA
} from "../../lib/fechaArgentina";

export { ZONA_HORARIA, diaDeFecha, inicioDelMes, mesAnterior, mesDeFecha, ultimoDiaDelMes, ultimosMeses };

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
