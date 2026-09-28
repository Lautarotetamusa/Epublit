import { useState } from "react";
import { Card, StatCard, Table, Badge, Button, IconButton, Field, Input, EmptyState, Pagination } from "../../design-system";
import type { Liquidacion, PersonaLiquidada, TipoPersonaLiquidacion } from "../../api/liquidacion";
import { useLiquidacion } from "./useLiquidacion";
import { DetallePersonaDialog } from "./DetallePersonaDialog";
import { formatMoney } from "./money";
import { downloadCsv } from "../../lib/csv";
import { useClientPagination } from "../../lib/useClientPagination";

const TIPO_LABEL = { autor: "Autor", ilustrador: "Ilustrador" } as const;

// Los roles distintos presentes en el detalle de una persona (puede ser
// autora de un libro e ilustradora de otro en el mismo período).
function rolesDePersona(persona: PersonaLiquidada): TipoPersonaLiquidacion[] {
    const roles = new Set(persona.detalle.map((d) => d.tipo));
    return [...roles];
}

const hoy = new Date();
const primerDiaDelMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10);
const hoyISO = hoy.toISOString().slice(0, 10);

function formatFecha(iso: string): string {
    return new Date(`${iso}T00:00:00`).toLocaleDateString("es-AR");
}

function exportarLibrosCsv(liquidacion: Liquidacion, desde: string, hasta: string): void {
    downloadCsv(
        `liquidacion-libros_${desde}_${hasta}.csv`,
        ["Título", "ISBN", "Cantidad", "Precio unitario", "Importe"],
        liquidacion.libros.map((l) => [l.titulo, l.isbn, l.cantidad_vendida, l.precio_unitario, l.importe_total])
    );
}

export function LiquidacionesPage() {
    const { liquidacion, loading, generar, limpiar } = useLiquidacion();
    const [desde, setDesde] = useState(primerDiaDelMes);
    const [hasta, setHasta] = useState(hoyISO);
    const [personaSeleccionada, setPersonaSeleccionada] = useState<PersonaLiquidada | null>(null);
    const librosPag = useClientPagination(liquidacion?.libros ?? []);
    const personasPag = useClientPagination(liquidacion?.personas ?? []);

    const rangoInvalido = desde > hasta;

    if (!liquidacion) {
        return (
            <Card title="Liquidación de ventas" subtitle="Elegí el período a liquidar">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", maxWidth: 420 }}>
                    <Field label="Desde" required error={rangoInvalido ? " " : undefined}>
                        <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} max={hasta} />
                    </Field>
                    <Field label="Hasta" required>
                        <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} min={desde} />
                    </Field>
                </div>
                {rangoInvalido ? (
                    <p style={{ color: "var(--text-error)", fontSize: "var(--text-sm)", marginTop: "var(--space-2)" }}>
                        La fecha "Desde" no puede ser posterior a "Hasta".
                    </p>
                ) : null}
                <div style={{ marginTop: "var(--space-6)" }}>
                    <Button iconStart="percent" loading={loading} disabled={rangoInvalido} onClick={() => generar({ desde, hasta })}>
                        Generar liquidación
                    </Button>
                </div>
            </Card>
        );
    }

    return (
        <div style={{ display: "grid", gap: "var(--space-4)" }}>
            <Card
                title="Liquidación de ventas"
                subtitle={`Del ${formatFecha(desde)} al ${formatFecha(hasta)}`}
                actions={
                    <>
                        <Button variant="secondary" size="sm" iconStart="printer" onClick={() => window.print()}>
                            Imprimir
                        </Button>
                        <Button variant="secondary" size="sm" iconStart="calendar" onClick={limpiar}>
                            Nueva liquidación
                        </Button>
                    </>
                }
            >
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "var(--space-4)" }}>
                    <StatCard label="Total facturado" value={formatMoney(liquidacion.total_facturado)} icon="banknote" />
                    <StatCard label="Ejemplares vendidos" value={liquidacion.ejemplares_vendidos} unit="ej." icon="package" />
                    <StatCard label="Personas a liquidar" value={liquidacion.personas.length} icon="users" />
                </div>
            </Card>

            <Card
                title="Libros vendidos en el período"
                padded={false}
                actions={
                    liquidacion.libros.length ? (
                        <Button variant="secondary" size="sm" iconStart="download" onClick={() => exportarLibrosCsv(liquidacion, desde, hasta)}>
                            Descargar CSV
                        </Button>
                    ) : undefined
                }
            >
                {liquidacion.libros.length ? (
                    <Table
                        columns={[
                            { header: "Título", key: "titulo", wrap: true },
                            { header: "ISBN", key: "isbn", mono: true },
                            { header: "Cantidad", align: "right", mono: true, key: "cantidad_vendida" },
                            { header: "Precio unitario", align: "right", mono: true, cell: (l) => formatMoney(l.precio_unitario) },
                            { header: "Importe", align: "right", mono: true, cell: (l) => <b>{formatMoney(l.importe_total)}</b> }
                        ]}
                        rows={librosPag.pageItems}
                        rowKey={(l) => l.id_libro}
                    />
                ) : (
                    <EmptyState icon="receipt-text" title="No se vendieron libros en este período" description="Probá con otro rango de fechas." />
                )}
                {librosPag.total > 0 ? (
                    <div style={{ padding: "var(--space-4)" }}>
                        <Pagination page={librosPag.page} pageCount={librosPag.pageCount} total={librosPag.total} onChange={librosPag.setPage} />
                    </div>
                ) : null}
            </Card>

            <Card title="Total a pagar por persona" padded={false}>
                {liquidacion.personas.length ? (
                    <Table
                        columns={[
                            { header: "Persona", key: "nombre" },
                            {
                                header: "Rol",
                                cell: (p: PersonaLiquidada) => (
                                    <div style={{ display: "flex", gap: "var(--space-1)", flexWrap: "wrap" }}>
                                        {rolesDePersona(p).map((rol) => (
                                            <Badge key={rol} tone={rol === "autor" ? "brand" : "accent"}>
                                                {TIPO_LABEL[rol]}
                                            </Badge>
                                        ))}
                                    </div>
                                )
                            },
                            { header: "Libros", cell: (p: PersonaLiquidada) => `${p.detalle.length} ${p.detalle.length === 1 ? "libro" : "libros"}`, muted: true },
                            { header: "Total a pagar", align: "right", mono: true, cell: (p: PersonaLiquidada) => <b>{formatMoney(p.total_a_pagar)}</b> },
                            {
                                header: "",
                                width: 48,
                                align: "right",
                                cell: (p: PersonaLiquidada) => (
                                    <IconButton icon="file-text" label={`Ver detalle de ${p.nombre}`} size="sm" onClick={() => setPersonaSeleccionada(p)} />
                                )
                            }
                        ]}
                        rows={personasPag.pageItems}
                        rowKey={(p) => p.id_persona}
                        onRowClick={(p: PersonaLiquidada) => setPersonaSeleccionada(p)}
                    />
                ) : (
                    <EmptyState icon="users" title="No hay nadie para liquidar en este período" description="Ningún libro con ventas tiene autores o ilustradores cargados." />
                )}
                {personasPag.total > 0 ? (
                    <div style={{ padding: "var(--space-4)" }}>
                        <Pagination page={personasPag.page} pageCount={personasPag.pageCount} total={personasPag.total} onChange={personasPag.setPage} />
                    </div>
                ) : null}
            </Card>

            {personaSeleccionada ? <DetallePersonaDialog persona={personaSeleccionada} onClose={() => setPersonaSeleccionada(null)} /> : null}
        </div>
    );
}
