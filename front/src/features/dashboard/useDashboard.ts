import { useEffect, useMemo, useState } from "react";
import { mesActual } from "../../lib/fecha";
import type {
    ComparacionMetricas,
    CortesMetricas,
    FilaClienteMetricas,
    FilaDepositoMetricas,
    FilaTituloMetricas,
    MetricasClient,
    PeriodoMetricas,
    ResumenMetricas,
    SerieMetricas
} from "../../api/metricas";
import type { AlcanceVentas, FilaDimension, Metrica, PuntoMedioPago, PuntoMensual, ResumenPanel } from "./tipos";

// El panel entero sale del grupo de endpoints `/metricas` (ver
// specs/014-metricas-ventas). El cliente de API entra por parámetro en vez de
// importarse como singleton (mismo criterio que los `create*Service` del back,
// ver front/CLAUDE.md): la página le pasa `metricasClient` y el recambio sería
// esa única línea.

export type PanelMetricas = {
    // Período elegido y con el que se compara, ya resueltos por el backend (el
    // mes en curso se recorta a hoy y la comparación es el mismo tramo).
    periodo: PeriodoMetricas;
    comparacion: ComparacionMetricas;
    resumen: ResumenPanel;
    resumenAnterior: ResumenPanel;
    porMes: PuntoMensual[];
    // Ingreso mensual promedio de la ventana de la serie: no viene directo del
    // backend, se deriva de `serie`.
    promedioMensual: number;
    porMedioPago: PuntoMedioPago[];
    porTitulo: FilaDimension[];
    porDeposito: FilaDimension[];
    porCliente: FilaDimension[];
};

const CIFRAS_CERO: ResumenPanel = { ingreso: 0, ejemplares: 0, ventas: 0, ejemplaresNuevos: 0 };

// Las cifras llegan con el `actual` y el `anterior` pegados; el Overview los
// necesita separados para comparar.
function resumenDe(resumen: ResumenMetricas | null, lado: "actual" | "anterior"): ResumenPanel {
    if (!resumen) return CIFRAS_CERO;
    return {
        ingreso: resumen.cifras.ingreso[lado],
        ejemplares: resumen.cifras.ejemplares[lado],
        ventas: resumen.cifras.ventas[lado],
        ejemplaresNuevos: resumen.cifras.ejemplaresNuevos[lado]
    };
}

function promedioDe(puntos: PuntoMensual[]): number {
    if (puntos.length === 0) return 0;
    return puntos.reduce((acc, punto) => acc + punto.ingreso, 0) / puntos.length;
}

// El ranking y el gráfico miden porcentajes 0–100 (`formatPorcentaje`); el
// backend manda porciones 0–1. La conversión queda acá, en el borde del panel.
const enPorcentaje = (porcion: number): number => porcion * 100;

// El orden lo decide la métrica elegida, que es también lo que mide la barra del
// gráfico. Los cortes llegan sin ordenar (el backend no ordena ni pagina).
function ordenar(filas: FilaDimension[], metrica: Metrica): FilaDimension[] {
    return [...filas].sort((a, b) => (metrica === "ejemplares" ? b.ejemplares - a.ejemplares : b.ingreso - a.ingreso));
}

function filasTitulo(rows: FilaTituloMetricas[]): FilaDimension[] {
    return rows.map((fila) => ({
        clave: fila.isbn,
        etiqueta: fila.titulo,
        isbn: fila.isbn,
        ventas: fila.ventas,
        ejemplares: fila.ejemplares,
        ingreso: fila.ingreso,
        porcentajeEjemplares: enPorcentaje(fila.porcionEjemplares),
        porcentajeIngreso: enPorcentaje(fila.porcionIngreso)
    }));
}

function filasCliente(rows: FilaClienteMetricas[]): FilaDimension[] {
    return rows.map((fila) => ({
        clave: String(fila.idCliente),
        etiqueta: fila.cliente,
        ventas: fila.ventas,
        ejemplares: fila.ejemplares,
        ingreso: fila.ingreso,
        porcentajeEjemplares: enPorcentaje(fila.porcionEjemplares),
        porcentajeIngreso: enPorcentaje(fila.porcionIngreso)
    }));
}

function filasDeposito(rows: FilaDepositoMetricas[]): FilaDimension[] {
    return rows.map((fila) => ({
        clave: String(fila.idDeposito ?? -1),
        etiqueta: fila.deposito ?? "Sin depósito",
        depositoDeCliente: fila.esDepositoCliente,
        clienteId: fila.idCliente ?? undefined,
        ventas: fila.ventas,
        ejemplares: fila.ejemplares,
        ingreso: fila.ingreso,
        porcentajeEjemplares: enPorcentaje(fila.porcionEjemplares),
        porcentajeIngreso: enPorcentaje(fila.porcionIngreso)
    }));
}

// Etiqueta corta del eje del gráfico mensual (`oct 26`).
function etiquetaDeMes(mes: string): string {
    const [anio, numeroDeMes] = mes.split("-").map(Number);
    return new Date(anio, numeroDeMes - 1, 1).toLocaleDateString("es-AR", { month: "short", year: "2-digit" });
}

export function useDashboard(cliente: MetricasClient) {
    // El período es un mes completo (`yyyy-mm`). Arranca vacío y lo fija la
    // lista real del backend, para no ofrecer un mes que no tenga datos.
    const [mes, setMes] = useState("");
    const [mesesDisponibles, setMesesDisponibles] = useState<string[]>([]);
    const [alcance, setAlcance] = useState<AlcanceVentas>("todas");
    const [metrica, setMetrica] = useState<Metrica>("ejemplares");

    const [resumenMetricas, setResumenMetricas] = useState<ResumenMetricas | null>(null);
    const [cortes, setCortes] = useState<CortesMetricas | null>(null);
    const [serie, setSerie] = useState<SerieMetricas | null>(null);
    const [medios, setMedios] = useState<PuntoMedioPago[]>([]);
    // Clave `mes:alcance` de los datos ya cargados: `loading` se deriva de si
    // coincide con la que se está mirando (evita un setState sincrónico dentro
    // del efecto, que dispararía un render en cascada).
    const [cargado, setCargado] = useState<string | null>(null);

    // Los meses del selector no dependen del alcance: se piden una sola vez. El
    // mes en curso abre el panel: la lista viene descendente y el backend
    // garantiza que está, aunque todavía no tenga movimientos.
    useEffect(() => {
        let vigente = true;
        cliente.meses().then((meses) => {
            if (!vigente) return;
            setMesesDisponibles(meses);
            setMes((actual) => (actual === "" ? meses[0] ?? mesActual() : actual));
        });
        return () => {
            vigente = false;
        };
    }, [cliente]);

    // Todo lo del mes y el alcance elegidos se pide junto: las cinco vistas
    // describen el mismo universo y no pueden quedar desfasadas entre sí.
    useEffect(() => {
        if (mes === "") return;
        let vigente = true;
        const clave = `${mes}:${alcance}`;
        Promise.all([
            cliente.resumen(mes, alcance),
            cliente.cortes(mes, alcance),
            cliente.serie(mes, alcance),
            cliente.mediosPago(mes, alcance)
        ]).then(([resumen, cortes, serie, medios]) => {
            if (!vigente) return;
            setResumenMetricas(resumen);
            setCortes(cortes);
            setSerie(serie);
            setMedios(medios.medios);
            setCargado(clave);
        });
        return () => {
            vigente = false;
        };
    }, [cliente, mes, alcance]);

    const loading = cargado !== `${mes}:${alcance}`;

    const panel = useMemo(() => {
        const porMes: PuntoMensual[] = (serie?.puntos ?? []).map((punto) => ({
            mes: punto.mes,
            etiqueta: etiquetaDeMes(punto.mes),
            ingreso: punto.ingreso
        }));

        return {
            resumen: resumenDe(resumenMetricas, "actual"),
            resumenAnterior: resumenDe(resumenMetricas, "anterior"),
            porMes,
            promedioMensual: promedioDe(porMes),
            // El medio principal es el de mayor ingreso: el backend los devuelve
            // por nombre y la pantalla necesita el top para el subtítulo.
            porMedioPago: [...medios].sort((a, b) => b.ingreso - a.ingreso),
            porTitulo: ordenar(cortes ? filasTitulo(cortes.titulo) : [], metrica),
            porDeposito: ordenar(cortes ? filasDeposito(cortes.deposito) : [], metrica),
            porCliente: ordenar(cortes ? filasCliente(cortes.cliente) : [], metrica)
        };
    }, [cortes, serie, medios, metrica, resumenMetricas]);

    const periodo: PeriodoMetricas = resumenMetricas?.periodo ?? { mes, desde: "", hasta: "", enCurso: false };
    const comparacion: ComparacionMetricas =
        resumenMetricas?.comparacion ?? { mes: "", desde: "", hasta: "", parcial: false };

    return {
        loading,
        mes,
        setMes,
        mesesDisponibles,
        alcance,
        setAlcance,
        metrica,
        setMetrica,
        periodo,
        comparacion,
        ...panel
    };
}
