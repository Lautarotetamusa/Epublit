import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Badge, Button, Card, EmptyState, Field, Icon, Pagination, SegmentedControl, Select, Table } from "../../design-system";
import type { Movimiento, TipoMovimiento } from "../../api/deposito";
import { useToast } from "../../notifications/ToastProvider";
import { ExtremoDisplay } from "./ExtremoDisplay";
import { MovimientoDetalleDialog } from "./MovimientoDetalleDialog";
import { formatearFecha, resumirLibros, TIPO_MOVIMIENTO, TIPOS_MOVIMIENTO, tipoDe } from "./movimientoFormato";
import { parsePrecargaMovimiento } from "./precargaMovimiento";
import { SeleccionLibrosMovimiento } from "./SeleccionLibrosMovimiento";
import { useMovimientoForm } from "./useMovimientoForm";
import { useMovimientos } from "./useMovimientos";

// Pantalla central de la historia: registrar un movimiento (ingreso, baja o
// transferencia) y consultar el historial. Un movimiento es la ÚNICA forma de
// crear o modificar stock: acá no hay ningún campo para "setear" cantidades.
export function MovimientosPage() {
    const [searchParams] = useSearchParams();
    const { showToast } = useToast();
    const { movimientos, refetch, page, setPage, total, totalPaginas, loading } = useMovimientos();
    const [detalle, setDetalle] = useState<Movimiento | null>(null);

    const form = useMovimientoForm(parsePrecargaMovimiento(searchParams), (movimiento) => {
        refetch();
        showToast("success", `Movimiento #${movimiento.id} registrado`);
        setDetalle(movimiento);
    });

    const handleSubmit = async () => {
        const error = await form.submit();
        if (error) showToast("error", error);
    };

    const origenNombre = form.tipo === "ingreso" ? null : (form.depositoOrigen?.nombre ?? null);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <Card title="Nuevo movimiento" subtitle="El stock de un libro se crea y se corrige sólo con movimientos.">
                <Field label="Tipo de movimiento" hint={TIPO_MOVIMIENTO[form.tipo].explicacion}>
                    <SegmentedControl
                        value={form.tipo}
                        onChange={(value) => form.cambiarTipo(value as TipoMovimiento)}
                        options={TIPOS_MOVIMIENTO.map((tipo) => ({ value: tipo, label: TIPO_MOVIMIENTO[tipo].label }))}
                    />
                </Field>

                {/* La ruta del movimiento: los dos extremos enfrentados con la
                    flecha en el medio. El extremo que el tipo deja fijo (el
                    exterior) se muestra como un rótulo, no como un control. */}
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto 1fr",
                        gap: "var(--space-4)",
                        alignItems: "end",
                        marginTop: "var(--space-5)"
                    }}
                >
                    <Field label="Origen">
                        {form.tipo === "ingreso" ? (
                            <ExtremoDisplay extremo={{ tipo: "exterior" }} variante="fijo" />
                        ) : (
                            <Select
                                value={form.origenId === "" ? "" : String(form.origenId)}
                                onChange={(e) => form.elegirOrigen(e.target.value === "" ? "" : Number(e.target.value))}
                                options={form.depositosOrigen}
                                placeholder="Elegí un depósito"
                            />
                        )}
                    </Field>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            height: "var(--height-control)",
                            color: "var(--text-subtle)"
                        }}
                    >
                        <Icon name="arrow-right" size={18} />
                    </div>
                    <Field label="Destino">
                        {form.tipo === "baja" ? (
                            <ExtremoDisplay extremo={{ tipo: "exterior" }} variante="fijo" />
                        ) : (
                            <Select
                                value={form.destinoId === "" ? "" : String(form.destinoId)}
                                onChange={(e) => form.elegirDestino(e.target.value === "" ? "" : Number(e.target.value))}
                                options={form.depositosDestino}
                                placeholder="Elegí un depósito"
                            />
                        )}
                    </Field>
                </div>

                {form.avisoPrecarga ? (
                    <Alert tone="warning" style={{ marginTop: "var(--space-5)" }} onClose={form.limpiarAvisoPrecarga}>
                        {form.avisoPrecarga}
                    </Alert>
                ) : null}

                <div style={{ marginTop: "var(--space-5)" }}>
                    <SeleccionLibrosMovimiento
                        libros={form.librosParaMover}
                        seleccionados={form.seleccionados}
                        origenNombre={origenNombre}
                        onAgregar={form.agregar}
                        onActualizarCantidad={form.actualizar}
                        onQuitar={form.quitar}
                    />
                </div>

                {/* El movimiento es atómico: si falta stock en el origen no se
                    mueve ninguno de los libros. Por eso el aviso dice qué falta
                    —libro por libro— y que no se movió nada. */}
                {form.faltantes.length > 0 ? (
                    <Alert
                        tone="error"
                        title={`No hay stock suficiente en «${form.depositoOrigen?.nombre}»`}
                        style={{ marginTop: "var(--space-4)" }}
                    >
                        <ul style={{ margin: 0, paddingLeft: "var(--space-5)" }}>
                            {form.faltantes.map((faltante) => (
                                <li key={faltante.isbn}>
                                    «{faltante.titulo}»: pedís {faltante.pedida} y hay {faltante.disponible}.
                                </li>
                            ))}
                        </ul>
                        No se movió nada. Ajustá las cantidades y volvé a intentar.
                    </Alert>
                ) : null}

                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "var(--space-4)",
                        flexWrap: "wrap",
                        marginTop: "var(--space-5)"
                    }}
                >
                    <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                        {form.seleccionados.length === 0 ? "Todavía no agregaste libros." : resumirLibros(form.seleccionados)}
                    </span>
                    <Button onClick={handleSubmit} loading={form.submitting} disabled={form.faltantes.length > 0}>
                        Registrar movimiento
                    </Button>
                </div>
            </Card>

            <Card title="Historial de movimientos" subtitle="Del más reciente al más antiguo." padded={false}>
                <Table
                    columns={[
                        { header: "Fecha", cell: (row: Movimiento) => formatearFecha(row.fecha) },
                        {
                            header: "Movimiento",
                            cell: (row: Movimiento) => {
                                const tipo = tipoDe(row);
                                return (
                                    <Badge tone={TIPO_MOVIMIENTO[tipo].tono} icon={TIPO_MOVIMIENTO[tipo].icono}>
                                        {TIPO_MOVIMIENTO[tipo].label}
                                    </Badge>
                                );
                            }
                        },
                        { header: "Origen", cell: (row: Movimiento) => <ExtremoDisplay extremo={row.origen} /> },
                        { header: "Destino", cell: (row: Movimiento) => <ExtremoDisplay extremo={row.destino} /> },
                        { header: "Libros", cell: (row: Movimiento) => resumirLibros(row.libros), muted: true }
                    ]}
                    rows={movimientos}
                    onRowClick={(row: Movimiento) => setDetalle(row)}
                    empty={
                        loading ? (
                            "Cargando..."
                        ) : (
                            <EmptyState
                                icon="package"
                                title="Todavía no hay movimientos"
                                description="Cargá stock con un ingreso desde el exterior, o pasá libros de un depósito a otro."
                            />
                        )
                    }
                />
                {total > 0 ? (
                    <div style={{ padding: "var(--space-4)" }}>
                        <Pagination page={page} pageCount={totalPaginas} total={total} onChange={setPage} />
                    </div>
                ) : null}
            </Card>

            {detalle ? <MovimientoDetalleDialog movimiento={detalle} onClose={() => setDetalle(null)} /> : null}
        </div>
    );
}
