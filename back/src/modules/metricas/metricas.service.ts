import { redondear2 } from "../../lib/venta";
import { LineaDelPeriodo, MetricasRepository, TipoVenta, VentaDelPeriodo } from "./metricas.repository";
import { AlcanceMetricas } from "./metricas.validator";
import { inicioDelMes, mesDeFecha, resolverPeriodo, Tramo, ultimosMeses } from "./metricas.periodo";

export type MetricasServiceDeps = {
    repository: MetricasRepository;
};

// El alcance no toca los ejemplares nuevos (son producción, no venta): sólo
// decide qué tipos de movimiento entran en las cifras comerciales y los cortes.
const TIPOS_POR_ALCANCE: Record<AlcanceMetricas, TipoVenta[]> = {
    todas: ["venta", "ventaConsignacion"],
    firme: ["venta"],
    consignacion: ["ventaConsignacion"]
};

// Fila sin depósito (no debería pasar en una venta, pero evita colisionar con
// un id real si el origen no resolviera).
const SIN_DEPOSITO = -1;

const MESES_SERIE = 12;

export type CifraComparada = { actual: number; anterior: number };

export type ResumenMetricas = {
    periodo: { mes: string; desde: string; hasta: string; enCurso: boolean };
    comparacion: { mes: string; desde: string; hasta: string; parcial: boolean };
    cifras: {
        ingreso: CifraComparada;
        ejemplares: CifraComparada;
        ventas: CifraComparada;
        ejemplaresNuevos: CifraComparada;
    };
};

export type FilaCorte = {
    ejemplares: number;
    ingreso: number;
    ventas: number;
    porcionEjemplares: number;
    porcionIngreso: number;
};

export type FilaTitulo = FilaCorte & { isbn: string; titulo: string };
export type FilaCliente = FilaCorte & { idCliente: number; cliente: string };
export type FilaDeposito = FilaCorte & { idDeposito: number | null; deposito: string | null; esDepositoCliente: boolean; idCliente: number | null };

export type CortesMetricas = {
    titulo: FilaTitulo[];
    cliente: FilaCliente[];
    deposito: FilaDeposito[];
};

export type SerieMetricas = {
    enCurso: boolean;
    puntos: { mes: string; ingreso: number }[];
};

export type MediosPagoMetricas = {
    medios: { medio: string; ingreso: number }[];
};

export type CifrasDelPeriodo = {
    ingreso: number;
    ejemplares: number;
    ventas: number;
    ejemplaresNuevos: number;
};

type Acumulador = { ejemplares: number; ingreso: number; movimientos: Set<number> };

// Reparte `total` entre los pesos dados, en centavos y con el método del resto
// mayor: la suma de las partes es exactamente el total, así el corte por título
// cierra con el total de la venta sin arrastrar un centavo de diferencia.
const repartir = (total: number, pesos: number[]): number[] => {
    if (pesos.length === 0) return [];

    const centavos = Math.round(redondear2(total) * 100);
    const efectivos = pesos.some((peso) => peso > 0) ? pesos : pesos.map(() => 1);
    const suma = efectivos.reduce((acc, peso) => acc + peso, 0);

    const exactos = efectivos.map((peso) => (centavos * peso) / suma);
    const bases = exactos.map(Math.floor);
    let sobrante = centavos - bases.reduce((acc, valor) => acc + valor, 0);

    const porResto = exactos
        .map((valor, indice) => ({ indice, resto: valor - Math.floor(valor) }))
        .sort((a, b) => b.resto - a.resto);

    for (const { indice } of porResto) {
        if (sobrante <= 0) break;
        bases[indice] += 1;
        sobrante -= 1;
    }

    return bases.map((valor) => valor / 100);
};

const acumular = <Extra>(
    mapa: Map<number, Acumulador & Extra>,
    clave: number,
    base: Extra,
    ejemplares: number,
    ingreso: number,
    movimientoId: number
): void => {
    const acumulado = mapa.get(clave) ?? { ...base, ejemplares: 0, ingreso: 0, movimientos: new Set<number>() };
    acumulado.ejemplares += ejemplares;
    acumulado.ingreso = redondear2(acumulado.ingreso + ingreso);
    acumulado.movimientos.add(movimientoId);
    mapa.set(clave, acumulado);
};

const filaCorte = ({ ejemplares, ingreso, movimientos }: Acumulador, totalEjemplares: number, totalIngreso: number): FilaCorte => ({
    ejemplares,
    ingreso,
    ventas: movimientos.size,
    porcionEjemplares: totalEjemplares > 0 ? ejemplares / totalEjemplares : 0,
    porcionIngreso: totalIngreso > 0 ? ingreso / totalIngreso : 0
});

// Agrupa las ventas del período en los tres cortes. El ingreso de un título es
// la parte del total de cada venta que le corresponde según el importe de su
// línea; cliente y depósito toman el total de la venta completa.
const cortesDesde = (ventas: VentaDelPeriodo[], lineas: LineaDelPeriodo[]): CortesMetricas => {
    const lineasPorVenta = new Map<number, LineaDelPeriodo[]>();
    for (const linea of lineas) {
        lineasPorVenta.set(linea.movimiento_id, [...(lineasPorVenta.get(linea.movimiento_id) ?? []), linea]);
    }

    const porTitulo = new Map<number, Acumulador & { isbn: string; titulo: string }>();
    const porCliente = new Map<number, Acumulador & { idCliente: number; cliente: string }>();
    const porDeposito = new Map<number, Acumulador & { idDeposito: number | null; deposito: string | null; esDepositoCliente: boolean; idCliente: number | null }>();

    let totalEjemplares = 0;
    let totalIngreso = 0;

    for (const venta of ventas) {
        const lineasVenta = lineasPorVenta.get(venta.movimiento_id) ?? [];
        const reparto = repartir(venta.total, lineasVenta.map((linea) => linea.cantidad * linea.precio));
        const ejemplaresVenta = lineasVenta.reduce((acc, linea) => acc + linea.cantidad, 0);
        const ingresoVenta = redondear2(venta.total);

        lineasVenta.forEach((linea, indice) => {
            acumular(porTitulo, linea.id_libro, { isbn: linea.isbn, titulo: linea.titulo }, linea.cantidad, reparto[indice], venta.movimiento_id);
        });
        acumular(porCliente, venta.id_cliente, { idCliente: venta.id_cliente, cliente: venta.cliente }, ejemplaresVenta, ingresoVenta, venta.movimiento_id);
        acumular(
            porDeposito,
            venta.id_deposito ?? SIN_DEPOSITO,
            {
                idDeposito: venta.id_deposito,
                deposito: venta.deposito,
                esDepositoCliente: venta.deposito_es_cliente,
                idCliente: venta.id_cliente_deposito
            },
            ejemplaresVenta,
            ingresoVenta,
            venta.movimiento_id
        );

        totalEjemplares += ejemplaresVenta;
        totalIngreso = redondear2(totalIngreso + ingresoVenta);
    }

    return {
        titulo: [...porTitulo.values()].map((acumulado) => ({
            isbn: acumulado.isbn,
            titulo: acumulado.titulo,
            ...filaCorte(acumulado, totalEjemplares, totalIngreso)
        })),
        cliente: [...porCliente.values()].map((acumulado) => ({
            idCliente: acumulado.idCliente,
            cliente: acumulado.cliente,
            ...filaCorte(acumulado, totalEjemplares, totalIngreso)
        })),
        deposito: [...porDeposito.values()].map((acumulado) => ({
            idDeposito: acumulado.idDeposito,
            deposito: acumulado.deposito,
            esDepositoCliente: acumulado.esDepositoCliente,
            idCliente: acumulado.idCliente,
            ...filaCorte(acumulado, totalEjemplares, totalIngreso)
        }))
    };
};

export function createMetricasService({ repository }: MetricasServiceDeps) {
    const tiposDe = (alcance: AlcanceMetricas): TipoVenta[] => TIPOS_POR_ALCANCE[alcance];

    const cifrasDelPeriodo = async (userId: number, tramo: Tramo, alcance: AlcanceMetricas): Promise<CifrasDelPeriodo> => {
        const tipos = tiposDe(alcance);
        const [ventas, lineas, ejemplaresNuevos] = await Promise.all([
            repository.getVentas(userId, tipos, tramo.desdeInstante, tramo.hastaInstante),
            repository.getLineas(userId, tipos, tramo.desdeInstante, tramo.hastaInstante),
            repository.getEjemplaresNuevos(userId, tramo.desdeInstante, tramo.hastaInstante)
        ]);

        return {
            ingreso: redondear2(ventas.reduce((acc, venta) => acc + venta.total, 0)),
            ejemplares: lineas.reduce((acc, linea) => acc + linea.cantidad, 0),
            ventas: ventas.length,
            ejemplaresNuevos
        };
    };

    // Meses que el selector puede ofrecer: todos los que tienen algún
    // movimiento del panel, más el mes en curso aunque todavía no tenga nada.
    const meses = async (userId: number, ahora: Date = new Date()): Promise<{ meses: string[] }> => {
        const disponibles = await repository.getMeses(userId);
        const unicos = Array.from(new Set([...disponibles, mesDeFecha(ahora)]));

        return { meses: unicos.sort((a, b) => (a < b ? 1 : -1)) };
    };

    const resumen = async (userId: number, mes: string, alcance: AlcanceMetricas, ahora: Date = new Date()): Promise<ResumenMetricas> => {
        const { periodo, enCurso, comparacion, comparacionParcial } = resolverPeriodo(mes, ahora);

        const [actual, anterior] = await Promise.all([
            cifrasDelPeriodo(userId, periodo, alcance),
            cifrasDelPeriodo(userId, comparacion, alcance)
        ]);

        return {
            periodo: { mes, desde: periodo.desde, hasta: periodo.hasta, enCurso },
            comparacion: { mes: comparacion.mes, desde: comparacion.desde, hasta: comparacion.hasta, parcial: comparacionParcial },
            cifras: {
                ingreso: { actual: actual.ingreso, anterior: anterior.ingreso },
                ejemplares: { actual: actual.ejemplares, anterior: anterior.ejemplares },
                ventas: { actual: actual.ventas, anterior: anterior.ventas },
                ejemplaresNuevos: { actual: actual.ejemplaresNuevos, anterior: anterior.ejemplaresNuevos }
            }
        };
    };

    const cortes = async (userId: number, mes: string, alcance: AlcanceMetricas, ahora: Date = new Date()): Promise<CortesMetricas> => {
        const { periodo } = resolverPeriodo(mes, ahora);
        const tipos = tiposDe(alcance);

        const [ventas, lineas] = await Promise.all([
            repository.getVentas(userId, tipos, periodo.desdeInstante, periodo.hastaInstante),
            repository.getLineas(userId, tipos, periodo.desdeInstante, periodo.hastaInstante)
        ]);

        return cortesDesde(ventas, lineas);
    };

    const serie = async (userId: number, mes: string, alcance: AlcanceMetricas, ahora: Date = new Date()): Promise<SerieMetricas> => {
        const { periodo, enCurso } = resolverPeriodo(mes, ahora);
        const mesesSerie = ultimosMeses(mes, MESES_SERIE);
        const porMes = await repository.getIngresoPorMes(userId, tiposDe(alcance), inicioDelMes(mesesSerie[0]), periodo.hastaInstante);
        const ingresoPorMes = new Map(porMes.map((fila) => [fila.mes, redondear2(fila.ingreso)]));

        return {
            enCurso,
            puntos: mesesSerie.map((punto) => ({ mes: punto, ingreso: ingresoPorMes.get(punto) ?? 0 }))
        };
    };

    const mediosPago = async (userId: number, mes: string, alcance: AlcanceMetricas, ahora: Date = new Date()): Promise<MediosPagoMetricas> => {
        const { periodo } = resolverPeriodo(mes, ahora);
        const filas = await repository.getIngresoPorMedioPago(userId, tiposDe(alcance), periodo.desdeInstante, periodo.hastaInstante);

        return { medios: filas.map((fila) => ({ medio: fila.medio, ingreso: redondear2(fila.ingreso) })) };
    };

    return { meses, resumen, cortes, serie, mediosPago };
}

export type MetricasService = ReturnType<typeof createMetricasService>;
