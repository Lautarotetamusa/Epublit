import { Badge, EmptyState, Table } from "../../design-system";
import { formatMoney } from "../../lib/money";
import { formatEntero, formatPorcentaje } from "./formato";
import type { Dimension, FilaDimension } from "./tipos";

type Props = {
    filas: FilaDimension[];
    dimension: Dimension;
    loading: boolean;
    onAbrirFicha: (fila: FilaDimension) => void;
};

const ENCABEZADOS: Record<Dimension, string> = {
    titulo: "Título",
    deposito: "Depósito",
    cliente: "Cliente"
};

// La celda de identidad del corte por título lleva el ISBN debajo y en mono:
// suma el dato sin gastar una columna entera, que en esta tabla ya hay dos
// porcentajes.
function CeldaTitulo({ fila }: { fila: FilaDimension }) {
    return (
        <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span>{fila.etiqueta}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                {fila.isbn}
            </span>
        </span>
    );
}

// El corte por depósito distingue las bodegas de la editorial de los depósitos
// consignados en un cliente (ver api/deposito.ts): sin esa marca, "Librería
// Rayuela" parecería un galpón propio.
function CeldaDeposito({ fila }: { fila: FilaDimension }) {
    return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
            {fila.etiqueta}
            {fila.depositoDeCliente ? <Badge tone="accent">Consignación</Badge> : null}
        </span>
    );
}

export function TablaDimension({ filas, dimension, loading, onAbrirFicha }: Props) {
    // `align` se anota como literal para que la columna no ensanche a `string`
    // y siga siendo asignable al contrato de la tabla.
    const derecha = "right" as const;

    const columnaIdentidad = {
        header: ENCABEZADOS[dimension],
        wrap: true,
        cell: (fila: FilaDimension) =>
            dimension === "titulo" ? <CeldaTitulo fila={fila} /> : dimension === "deposito" ? <CeldaDeposito fila={fila} /> : fila.etiqueta
    };

    const columnas = [
        columnaIdentidad,
        { header: "Ventas", align: derecha, mono: true, width: 90, cell: (fila: FilaDimension) => formatEntero(fila.ventas) },
        {
            header: "Ejemplares",
            align: derecha,
            mono: true,
            width: 120,
            cell: (fila: FilaDimension) => formatEntero(fila.ejemplares)
        },
        {
            header: "% ejemplares",
            align: derecha,
            mono: true,
            muted: true,
            width: 130,
            cell: (fila: FilaDimension) => formatPorcentaje(fila.porcentajeEjemplares)
        },
        {
            header: "Ingreso",
            align: derecha,
            mono: true,
            width: 150,
            cell: (fila: FilaDimension) => formatMoney(fila.ingreso)
        },
        {
            header: "% ingreso",
            align: derecha,
            mono: true,
            muted: true,
            width: 120,
            cell: (fila: FilaDimension) => formatPorcentaje(fila.porcentajeIngreso)
        }
    ];

    return (
        <Table
            columns={columnas}
            rows={filas}
            rowKey={(fila) => fila.clave}
            onRowClick={onAbrirFicha}
            empty={
                loading ? (
                    "Cargando..."
                ) : (
                    <EmptyState
                        icon="chart-column"
                        title="Sin ventas en el mes"
                        description="Probá elegir otro mes o cambiar las ventas incluidas."
                    />
                )
            }
        />
    );
}
