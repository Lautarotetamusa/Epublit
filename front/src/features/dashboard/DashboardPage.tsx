import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { metricasClient } from "../../api/metricas";
import type { ComparacionMetricas, PeriodoMetricas } from "../../api/metricas";
import { Button, Card, Pagination, SegmentedControl, Select, StatCard, Tabs } from "../../design-system";
import { downloadCsv } from "../../lib/csv";
import { formatMes, formatMesCorto } from "../../lib/fecha";
import { formatMoney } from "../../lib/money";
import { useClientPagination } from "../../lib/useClientPagination";
import { DeltaBadge } from "./DeltaBadge";
import { GraficoIngresoMensual } from "./GraficoIngresoMensual";
import { GraficoMedioPago } from "./GraficoMedioPago";
import { GraficoTopDimension, TOP } from "./GraficoTopDimension";
import { TablaDimension } from "./TablaDimension";
import { useDashboard } from "./useDashboard";
import { formatEntero, formatPorcentaje } from "./formato";
import type { AlcanceVentas, Dimension, FilaDimension, Metrica } from "./tipos";

// El orden de las pestañas sigue el de las historias originales: qué se vendió,
// desde dónde salió y a quién.
const CORTES: Record<Dimension, { label: string; singular: string }> = {
    titulo: { label: "Por título", singular: "título" },
    deposito: { label: "Por depósito", singular: "depósito" },
    cliente: { label: "Por cliente", singular: "cliente" }
};

const OPCIONES_ALCANCE = [
    { value: "todas", label: "Todas" },
    { value: "firme", label: "En firme" },
    { value: "consignacion", label: "Sobre consignación" }
];

// Lo que ordena el ranking y lo que mide la barra del gráfico.
const OPCIONES_METRICA = [
    { value: "ejemplares", label: "Por ejemplares" },
    { value: "ingreso", label: "Por ingreso" }
];

function porcentajeDe(parte: number, total: number): number {
    return total === 0 ? 0 : (parte / total) * 100;
}

// La etiqueta de un control del header: chica, al lado del control, para que el
// desplegable no tenga que decir por sí solo qué está eligiendo.
const ETIQUETA_CONTROL = {
    fontSize: "var(--text-xs)",
    fontWeight: "var(--weight-semibold)",
    color: "var(--papel-700)",
    whiteSpace: "nowrap"
} as const;

// El tramo de días de un período ("1–16"), leído de las fechas ISO del backend:
// el mes en curso y su comparación se miden por la misma cantidad de días y el
// texto tiene que decir de dónde a dónde.
function rangoDias(desde: string, hasta: string): string {
    const dia = (iso: string) => Number(iso.slice(8, 10));
    return `${dia(desde)}–${dia(hasta)}`;
}

// El mes en curso está a medias: se marca junto al mes y, sobre todo, la base de
// comparación se dice con los días (1–16), para que la caída contra el mismo
// tramo del mes anterior no se lea como una caída de ventas.
function subtituloOverview(periodo: PeriodoMetricas, comparacion: ComparacionMetricas): string {
    if (!comparacion.mes) return formatMes(periodo.mes);
    if (!periodo.enCurso) return `${formatMes(periodo.mes)} contra ${formatMes(comparacion.mes)}`;
    return `${formatMes(periodo.mes)} (en curso: ${rangoDias(periodo.desde, periodo.hasta)}) contra el ${rangoDias(
        comparacion.desde,
        comparacion.hasta
    )} de ${formatMesCorto(comparacion.mes, periodo.mes)}`;
}

// El período comparado, con la preposición adentro porque el tooltip la necesita:
// mes completo ("en septiembre") o el mismo tramo de días ("el 1–16 de septiembre").
function periodoComparadoDe(periodo: PeriodoMetricas, comparacion: ComparacionMetricas): string {
    const nombre = formatMesCorto(comparacion.mes, periodo.mes);
    return comparacion.parcial ? `el ${rangoDias(comparacion.desde, comparacion.hasta)} de ${nombre}` : `en ${nombre}`;
}

// La concentración es el insight más barato del panel: dice de entrada si lo que
// se vende está repartido o se apoya en unos pocos nombres.
function subtituloDimension(filas: FilaDimension[], metrica: Metrica): string {
    if (filas.length === 0) return "Sin ventas en el mes.";
    const esEjemplares = metrica === "ejemplares";
    // La frase trae la preposición adentro: "de los ejemplares" / "del ingreso",
    // que no es la misma contracción para las dos magnitudes.
    const magnitud = esEjemplares ? "de los ejemplares" : "del ingreso";
    if (filas.length <= TOP) {
        return esEjemplares
            ? "Todos los ejemplares del mes, ordenados de mayor a menor."
            : "Todo el ingreso del mes, ordenado de mayor a menor.";
    }
    const top = filas
        .slice(0, TOP)
        .reduce((acc, fila) => acc + (esEjemplares ? fila.porcentajeEjemplares : fila.porcentajeIngreso), 0);
    return `El Top ${TOP} explica el ${formatPorcentaje(top)} ${magnitud} del mes.`;
}

export function DashboardPage() {
    const navigate = useNavigate();
    const {
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
        resumen,
        resumenAnterior,
        porMes,
        promedioMensual,
        porMedioPago,
        porTitulo,
        porDeposito,
        porCliente
    } = useDashboard(metricasClient);

    const [dimension, setDimension] = useState<Dimension>("titulo");

    const filas = dimension === "titulo" ? porTitulo : dimension === "deposito" ? porDeposito : porCliente;
    const { page, setPage, pageCount, pageItems, total } = useClientPagination(filas);

    // Cambiar de corte, de métrica, de mes o de alcance devuelve a la primera
    // página: la que se estaba mirando puede quedar afuera del nuevo total.
    useEffect(() => {
        setPage(1);
    }, [dimension, metrica, mes, alcance, setPage]);

    // Un depósito consignado es el stock que está en un cliente, así que su fila
    // abre la ficha del cliente y no /depositos/:id (que no existe para esos
    // depósitos, ver api/deposito.ts). El depósito propio sí tiene ficha.
    function abrirFicha(fila: FilaDimension) {
        if (dimension === "titulo") navigate(`/libros/${fila.clave}`);
        else if (dimension === "cliente") navigate(`/clientes/${fila.clave}`);
        else if (fila.clienteId != null) navigate(`/clientes/${fila.clienteId}`);
        else navigate(`/depositos/${fila.clave}`);
    }

    function exportarCsv() {
        const encabezados = [
            dimension === "titulo" ? "Título" : dimension === "deposito" ? "Depósito" : "Cliente",
            ...(dimension === "titulo" ? ["ISBN"] : []),
            "Ventas",
            "Ejemplares",
            "% ejemplares",
            "Ingreso",
            "% ingreso"
        ];

        const cuerpo = filas.map((fila) => [
            fila.etiqueta,
            ...(dimension === "titulo" ? [fila.isbn ?? ""] : []),
            fila.ventas,
            fila.ejemplares,
            formatPorcentaje(fila.porcentajeEjemplares),
            fila.ingreso,
            formatPorcentaje(fila.porcentajeIngreso)
        ]);

        downloadCsv(`metricas-por-${dimension}-${mes}.csv`, encabezados, cuerpo);
    }

    // Las cuatro cifras del mes, cada una con lo que hay que comparar. Van en un
    // array para que la fila del Overview se escriba una sola vez.
    const figuras = [        {
            etiqueta: "Ingreso generado",
            icono: "banknote",
            valor: formatMoney(resumen.ingreso),
            actual: resumen.ingreso,
            anterior: resumenAnterior.ingreso
        },
        {
            etiqueta: "Ejemplares vendidos",
            icono: "boxes",
            valor: formatEntero(resumen.ejemplares),
            actual: resumen.ejemplares,
            anterior: resumenAnterior.ejemplares
        },
        {
            etiqueta: "Ventas",
            icono: "receipt-text",
            valor: formatEntero(resumen.ventas),
            actual: resumen.ventas,
            anterior: resumenAnterior.ventas
        },
        // Ejemplares que ENTRARON al stock (ingresos: lanzamiento y
        // reimpresiones). Es producción, así que no la mueve el filtro de ventas.
        {
            etiqueta: "Ejemplares nuevos",
            icono: "download",
            valor: formatEntero(resumen.ejemplaresNuevos),
            actual: resumen.ejemplaresNuevos,
            anterior: resumenAnterior.ejemplaresNuevos
        }
    ];

    const medioPrincipal = porMedioPago[0];
    // La base contra la que se comparan las cuatro cifras: el mismo tramo del mes
    // anterior si el mes está en curso, el mes entero si ya cerró. La resuelve el
    // backend y el texto sale de ahí, así no puede quedar desfasado del mes.
    const periodoComparado = periodoComparadoDe(periodo, comparacion);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            {/* Un solo bloque para el alcance del panel y las cifras del mes: el
                mes y las ventas incluidas son las dos perillas de todo lo que
                viene abajo, no de una tarjeta en particular. */}
            <Card
                title="Overview"
                subtitle={subtituloOverview(periodo, comparacion)}
                actions={
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-5)", flexShrink: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                            <span style={ETIQUETA_CONTROL}>Ventas incluidas</span>
                            {/* Desplegable y no segmentado: con tres opciones, la
                                tercera ("Sobre consignación") no entra en un
                                tercio del ancho y el texto se partía en dos
                                líneas. */}
                            <Select
                                size="sm"
                                options={OPCIONES_ALCANCE}
                                value={alcance}
                                onChange={(e) => setAlcance(e.target.value as AlcanceVentas)}
                                aria-label="Ventas incluidas"
                                style={{ width: 190 }}
                            />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                            <span style={ETIQUETA_CONTROL}>Mes</span>
                            <Select
                                size="sm"
                                options={mesesDisponibles.map((cadaMes) => ({ value: cadaMes, label: formatMes(cadaMes) }))}
                                value={mes}
                                onChange={(e) => setMes(e.target.value)}
                                aria-label="Mes"
                                style={{ width: 178 }}
                            />
                        </div>
                    </div>
                }
                padded={false}
            >
                {/* `marginLeft: -1` corre la grilla un píxel para que el divisor
                    del primer lugar coincida con el borde de la tarjeta y no se
                    vea una raya suelta; al plegarse, cada fila nueva hace lo
                    mismo. */}
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))",
                        marginLeft: -1
                    }}
                >
                    {figuras.map((figura) => (
                        <div
                            key={figura.etiqueta}
                            style={{ padding: "var(--space-4) var(--space-5)", borderLeft: "1px solid var(--border-subtle)" }}
                        >
                            <StatCard
                                variant="bare"
                                label={figura.etiqueta}
                                value={loading ? "..." : figura.valor}
                                icon={figura.icono}
                                delta={
                                    loading ? undefined : (
                                        <DeltaBadge
                                            actual={figura.actual}
                                            anterior={figura.anterior}
                                            periodoComparado={periodoComparado}
                                            magnitud={figura.etiqueta.toLowerCase()}
                                        />
                                    )
                                }
                            />
                        </div>
                    ))}
                </div>
            </Card>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(min(380px, 100%), 1fr))",
                    gap: "var(--space-6)"
                }}
            >
                <Card
                    title="Ingreso por mes"
                    subtitle={
                        porMes.length === 0
                            ? "Sin datos del período."
                            : `Los ${porMes.length} meses hasta ${formatMes(mes)}${
                                  periodo.enCurso ? "; el último está en curso" : ""
                              }. Ingreso mensual promedio: ${formatMoney(promedioMensual)}.`
                    }
                >
                    <GraficoIngresoMensual puntos={porMes} mesElegido={mes} />
                </Card>
                <Card
                    title="Ingreso por medio de pago"
                    subtitle={
                        medioPrincipal && resumen.ingreso > 0
                            ? `${formatPorcentaje(porcentajeDe(medioPrincipal.ingreso, resumen.ingreso))} del ingreso entró por ${medioPrincipal.medio.toLowerCase()}.`
                            : "Sin ventas en el mes."
                    }
                >
                    <GraficoMedioPago puntos={porMedioPago} />
                </Card>
            </div>

            <Card
                title={`Ejemplares e ingreso por ${CORTES[dimension].singular}`}
                subtitle={subtituloDimension(filas, metrica)}
                actions={
                    <>
                        <div style={{ width: 280, flexShrink: 0 }}>
                            <SegmentedControl
                                size="sm"
                                options={OPCIONES_METRICA}
                                value={metrica}
                                onChange={(value) => setMetrica(value as Metrica)}
                                aria-label="Ordenar por"
                            />
                        </div>
                        <Button
                            variant="secondary"
                            iconStart="download"
                            disabled={loading || filas.length === 0}
                            onClick={exportarCsv}
                        >
                            Exportar CSV
                        </Button>
                    </>
                }
                padded={false}
                footer={
                    filas.length > 0 ? (
                        <Pagination page={page} pageCount={pageCount} total={total} onChange={setPage} />
                    ) : undefined
                }
            >
                <div style={{ padding: "var(--space-3) var(--space-5) 0" }}>
                    <Tabs
                        items={[
                            { value: "titulo", label: CORTES.titulo.label, count: porTitulo.length },
                            { value: "deposito", label: CORTES.deposito.label, count: porDeposito.length },
                            { value: "cliente", label: CORTES.cliente.label, count: porCliente.length }
                        ]}
                        value={dimension}
                        onChange={(value) => setDimension(value as Dimension)}
                    />
                </div>

                {filas.length > 0 ? (
                    <div style={{ padding: "var(--space-5) var(--space-5) var(--space-2)" }}>
                        <GraficoTopDimension filas={filas} metrica={metrica} />
                    </div>
                ) : null}

                <TablaDimension filas={pageItems} dimension={dimension} loading={loading} onAbrirFicha={abrirFicha} />
            </Card>
        </div>
    );
}
