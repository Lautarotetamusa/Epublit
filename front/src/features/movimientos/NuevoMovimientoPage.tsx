import { useNavigate, useSearchParams } from "react-router-dom";
import { Alert, Breadcrumb, Button, Card, Field, Icon, SegmentedControl, Select } from "../../design-system";
import type { TipoMovimientoManual } from "../../api/deposito";
import { useToast } from "../../notifications/ToastProvider";
import { ExtremoDisplay } from "./ExtremoDisplay";
import { resumirLibros, TIPO_MOVIMIENTO, TIPOS_MOVIMIENTO } from "./movimientoFormato";
import { parsePrecargaMovimiento } from "./precargaMovimiento";
import { SeleccionLibrosMovimiento } from "./SeleccionLibrosMovimiento";
import { useMovimientoForm } from "./useMovimientoForm";

// Alta de un movimiento (ingreso, baja o transferencia). El movimiento es la
// ÚNICA forma de crear o modificar stock: acá no hay ningún campo para "setear"
// cantidades.
export function NuevoMovimientoPage() {
    const [searchParams] = useSearchParams();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const form = useMovimientoForm(parsePrecargaMovimiento(searchParams), (movimiento) => {
        showToast("success", `Movimiento #${movimiento.id} registrado`);
        navigate(`/movimientos/${movimiento.id}`);
    });

    const handleSubmit = async () => {
        const error = await form.submit();
        if (error) showToast("error", error);
    };

    const origenNombre = form.tipo === "ingreso" ? null : (form.depositoOrigen?.nombre ?? null);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <Breadcrumb
                items={["Movimientos", "Nuevo movimiento"]}
                onNavigate={(_item, index) => index === 0 && navigate("/movimientos")}
            />
            <Card title="Nuevo movimiento" subtitle="El stock de un libro se crea y se corrige sólo con movimientos.">
                <Field label="Tipo de movimiento" hint={TIPO_MOVIMIENTO[form.tipo].explicacion}>
                    <SegmentedControl
                        value={form.tipo}
                        onChange={(value) => form.cambiarTipo(value as TipoMovimientoManual)}
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
        </div>
    );
}
