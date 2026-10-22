import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Badge, Breadcrumb, Button, Card, EmptyState, Field, Input, Pagination, StatCard, Table } from "../../design-system";
import type { PersonaLiquidada } from "../../api/liquidacion";
import { useToast } from "../../notifications/ToastProvider";
import { getErrorMessage } from "../../lib/errors";
import { useClientPagination } from "../../lib/useClientPagination";
import { nombreVisible, tonoDeRol } from "../roles/presentacionRol";
import { formatMoney } from "../../lib/money";
import { DetallePersonaDialog } from "./DetallePersonaDialog";
import { rolesDePersona } from "./rolesDePersona";
import { usePrevisualizacionLiquidacion } from "./usePrevisualizacionLiquidacion";
import { useNuevaLiquidacion } from "./useNuevaLiquidacion";
import { hoyISO, primerDiaDelMes } from "./presentacionLiquidacion";

// La liquidación dejó de ser un reporte que se mira: ahora se genera, queda
// guardada y se paga en partes. Por eso esta pantalla muestra primero qué va a
// quedar adentro (el reporte del período menos lo ya liquidado) y recién después
// la acción de generar, que lleva a la ficha de la liquidación creada.
export function NuevaLiquidacionPage() {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [desde, setDesde] = useState(primerDiaDelMes());
    const [hasta, setHasta] = useState(hoyISO());
    const [personaSeleccionada, setPersonaSeleccionada] = useState<PersonaLiquidada | null>(null);

    const { previsualizacion, loading } = usePrevisualizacionLiquidacion(desde, hasta);
    const { saving, crear } = useNuevaLiquidacion();

    const librosPag = useClientPagination(previsualizacion?.libros ?? []);
    const personasPag = useClientPagination(previsualizacion?.personas ?? []);

    const rangoInvalido = desde > hasta;
    const hayPendientes = (previsualizacion?.personas.length ?? 0) > 0;
    const codigosYa = [...new Set((previsualizacion?.excluidas ?? []).map((e) => e.codigo))];
    const ventasExcluidas = (previsualizacion?.excluidas ?? []).reduce((suma, e) => suma + e.ventas, 0);

    const handleGenerar = async () => {
        if (!previsualizacion) return;
        try {
            const liquidacion = await crear(desde, hasta);
            showToast("success", `Liquidación ${liquidacion.codigo} generada`);
            navigate(`/liquidaciones/${liquidacion.id}`);
        } catch (err) {
            showToast("error", getErrorMessage(err));
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <Breadcrumb items={["Liquidaciones", "Nueva liquidación"]} onNavigate={(_item, index) => index === 0 && navigate("/liquidaciones")} />

            <Card
                title="Nueva liquidación"
                subtitle="Elegí el período a liquidar. Sólo entran las ventas que todavía no se liquidaron."
            >
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
            </Card>

            {!rangoInvalido && loading ? (
                <Card>
                    <p style={{ margin: 0, color: "var(--text-muted)" }}>Calculando las ventas del período…</p>
                </Card>
            ) : null}

            {!rangoInvalido && !loading && previsualizacion ? (
                previsualizacion.personas.length === 0 ? (
                    <Card>
                        <EmptyState
                            icon={codigosYa.length ? "circle-check" : "receipt-text"}
                            title={codigosYa.length ? "Las ventas de este período ya se liquidaron" : "No hay ventas para liquidar en este período"}
                            description={
                                codigosYa.length
                                    ? `Todas las ventas del período ya están cubiertas por ${codigosYa.join(", ")}. No se pueden liquidar dos veces. Probá con otro rango.`
                                    : "No se registraron ventas entre esas fechas. Probá con otro rango."
                            }
                        />
                    </Card>
                ) : (
                    <>
                        {previsualizacion.excluidas.length ? (
                            <Alert tone="warning" title="Hay ventas que quedan afuera">
                                {ventasExcluidas} {ventasExcluidas === 1 ? "venta del período ya se liquidó" : "ventas del período ya se liquidaron"} en{" "}
                                {codigosYa.join(", ")} y no se vuelven a incluir.
                            </Alert>
                        ) : null}

                        <Card title="Lo que se va a liquidar" subtitle="Revisá el período antes de generar la liquidación.">
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-4)" }}>
                                <StatCard label="Total a liquidar" value={formatMoney(previsualizacion.total)} icon="banknote" />
                                <StatCard label="Personas a liquidar" value={previsualizacion.personas.length} icon="users" />
                                <StatCard label="Ejemplares vendidos" value={previsualizacion.ejemplares} unit="ej." icon="package" />
                            </div>
                            <div style={{ marginTop: "var(--space-6)" }}>
                                <Button iconStart="percent" loading={saving} disabled={!hayPendientes} onClick={handleGenerar}>
                                    Generar liquidación
                                </Button>
                            </div>
                        </Card>

                        <Card title="Libros vendidos en el período" padded={false}>
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
                            {librosPag.total > 0 ? (
                                <div style={{ padding: "var(--space-4)" }}>
                                    <Pagination page={librosPag.page} pageCount={librosPag.pageCount} total={librosPag.total} onChange={librosPag.setPage} />
                                </div>
                            ) : null}
                        </Card>

                        <Card title="Total a pagar por persona" padded={false}>
                            <Table
                                columns={[
                                    { header: "Persona", key: "nombre", wrap: true },
                                    {
                                        header: "Rol",
                                        cell: (p: PersonaLiquidada) => (
                                            <div style={{ display: "flex", gap: "var(--space-1)", flexWrap: "wrap" }}>
                                                {rolesDePersona(p).map((rol) => (
                                                    <Badge key={rol.id} tone={tonoDeRol(rol)}>
                                                        {nombreVisible(rol.nombre)}
                                                    </Badge>
                                                ))}
                                            </div>
                                        )
                                    },
                                    {
                                        header: "Libros",
                                        cell: (p: PersonaLiquidada) => `${p.detalle.length} ${p.detalle.length === 1 ? "libro" : "libros"}`,
                                        muted: true
                                    },
                                    { header: "Total a pagar", align: "right", mono: true, cell: (p: PersonaLiquidada) => <b>{formatMoney(p.total_a_pagar)}</b> }
                                ]}
                                rows={personasPag.pageItems}
                                rowKey={(p) => p.id_persona}
                                onRowClick={(p: PersonaLiquidada) => setPersonaSeleccionada(p)}
                            />
                            {personasPag.total > 0 ? (
                                <div style={{ padding: "var(--space-4)" }}>
                                    <Pagination page={personasPag.page} pageCount={personasPag.pageCount} total={personasPag.total} onChange={personasPag.setPage} />
                                </div>
                            ) : null}
                        </Card>
                    </>
                )
            ) : null}

            {personaSeleccionada ? (
                <DetallePersonaDialog
                    nombre={personaSeleccionada.nombre}
                    roles={rolesDePersona(personaSeleccionada)}
                    detalle={personaSeleccionada.detalle}
                    total={personaSeleccionada.total_a_pagar}
                    onClose={() => setPersonaSeleccionada(null)}
                />
            ) : null}
        </div>
    );
}
