import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, EmptyState, ProgressBar, SegmentedControl, Table } from "../../design-system";
import type { LiquidacionResumen } from "../../api/liquidaciones";
import { formatRango } from "../../lib/fecha";
import { formatMoney } from "../../lib/money";
import { etiquetaEstado, porcentajePagado, tonoEstado } from "./presentacionLiquidacion";

type FiltroEstado = "todas" | "pendiente" | "parcial" | "pagada";

export function TablaLiquidaciones({ liquidaciones, loading }: { liquidaciones: LiquidacionResumen[]; loading: boolean }) {
    const navigate = useNavigate();
    const [filtro, setFiltro] = useState<FiltroEstado>("todas");

    const visibles = filtro === "todas" ? liquidaciones : liquidaciones.filter((l) => l.estado === filtro);

    return (
        <>
            <div style={{ padding: "var(--space-4) var(--space-5) 0" }}>
                <SegmentedControl
                    value={filtro}
                    onChange={(value) => setFiltro(value as FiltroEstado)}
                    style={{ maxWidth: 460 }}
                    options={[
                        { value: "todas", label: "Todas" },
                        { value: "pendiente", label: "Pendientes" },
                        { value: "parcial", label: "Parciales" },
                        { value: "pagada", label: "Pagadas" }
                    ]}
                />
            </div>
            <Table
                columns={[
                    { header: "Código", mono: true, cell: (l: LiquidacionResumen) => <b>{l.codigo}</b> },
                    { header: "Período", cell: (l: LiquidacionResumen) => formatRango(l.desde, l.hasta) },
                    { header: "Personas", align: "right", mono: true, cell: (l: LiquidacionResumen) => l.personas },
                    { header: "Total", align: "right", mono: true, cell: (l: LiquidacionResumen) => formatMoney(l.total) },
                    {
                        header: "Pagado",
                        width: 150,
                        cell: (l: LiquidacionResumen) => <ProgressBar value={porcentajePagado(l.total, l.pagado)} size="sm" />
                    },
                    { header: "Saldo", align: "right", mono: true, cell: (l: LiquidacionResumen) => <b>{formatMoney(l.saldo)}</b> },
                    {
                        header: "Estado",
                        cell: (l: LiquidacionResumen) => (
                            <Badge tone={tonoEstado(l.estado)} dot={l.estado === "pagada"}>
                                {etiquetaEstado(l.estado)}
                            </Badge>
                        )
                    }
                ]}
                rows={visibles}
                onRowClick={(l: LiquidacionResumen) => navigate(`/liquidaciones/${l.id}`)}
                empty={
                    loading ? (
                        "Cargando…"
                    ) : filtro !== "todas" ? (
                        <EmptyState icon="search" title="Ninguna liquidación en ese estado" description="Probá con otro filtro." />
                    ) : (
                        <EmptyState
                            icon="percent"
                            title="Todavía no hay liquidaciones"
                            description="Generá la primera para registrar lo que le corresponde a cada autor por las ventas de un período."
                        />
                    )
                }
            />
        </>
    );
}
