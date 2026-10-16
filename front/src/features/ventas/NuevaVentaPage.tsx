import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, Select, Combobox, SegmentedControl, Field, Input, Button, Breadcrumb } from "../../design-system";
import { useVentaForm } from "./useVentaForm";
import type { TipoVenta, VentaFormInitial } from "./useVentaForm";
import { SeleccionLibrosField } from "../operaciones/SeleccionLibrosField";
import { parsePrecargaOperacion } from "../../lib/precargaOperacion";
import { sanitizeDecimal } from "../../lib/numericInput";
import { useToast } from "../../notifications/ToastProvider";

// Lee la precarga que llega por URL (bulk action del catálogo, de la ficha de
// cliente, o "venta en firme" desde un cliente) y se la pasa a `useVentaForm`.
function useVentaFormInitial(): VentaFormInitial {
    const [searchParams] = useSearchParams();
    const tipoVenta = searchParams.get("tipoVenta");
    const { clienteId, isbns } = parsePrecargaOperacion(searchParams);

    return {
        isbns,
        clienteId,
        tipoVenta: tipoVenta === "firme" || tipoVenta === "consignacion" ? (tipoVenta as TipoVenta) : undefined
    };
}

export function NuevaVentaPage() {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const initial = useVentaFormInitial();
    const form = useVentaForm((venta) => {
        showToast("success", "Venta registrada correctamente");
        navigate(`/ventas/${venta.id}`);
    }, initial);

    const handleSubmit = async () => {
        const error = await form.submit();
        if (error) showToast("error", error);
    };

    // El neto que le queda al usuario por la comisión del medio de pago: se
    // calcula sobre el total de la venta (con el descuento aplicado, igual que
    // el backend) y sólo se muestra si el medio elegido cobra comisión.
    const medioSeleccionado = form.mediosPago.find((m) => m.id === form.medioPago);
    const descuentoPct = Number(form.descuento) || 0;
    const totalConDescuento = form.total - form.total * descuentoPct * 0.01;
    const notaComision =
        medioSeleccionado && medioSeleccionado.comision > 0
            ? `Comisión ${medioSeleccionado.comision}% · Neto ${(totalConDescuento * (1 - medioSeleccionado.comision * 0.01)).toLocaleString("es-AR")}`
            : undefined;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <Breadcrumb items={["Ventas", "Nueva venta"]} onNavigate={(_item, index) => index === 0 && navigate("/ventas")} />
            <Card title="Nueva venta">
                <Field label="Tipo de venta" required>
                    <SegmentedControl
                        value={form.tipoVenta}
                        onChange={(value) => form.setTipoVenta(value as "firme" | "consignacion")}
                        options={[
                            { value: "firme", label: "Venta en firme" },
                            { value: "consignacion", label: "Venta sobre consignación" }
                        ]}
                    />
                </Field>

                {form.tipoVenta ? (
                    <>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-4)", marginTop: "var(--space-4)" }}>
                            <Field label="Cliente" required>
                                <Combobox
                                    value={form.clienteId === "" ? "" : String(form.clienteId)}
                                    onChange={(value) => form.setClienteId(value === "" ? "" : Number(value))}
                                    options={form.clientes.map((c) => ({ value: String(c.id), label: c.nombre }))}
                                    placeholder="Buscá un cliente"
                                    emptyMessage="No se encontraron clientes"
                                />
                            </Field>
                            <Field label="Descuento (%)">
                                <Input
                                    type="text"
                                    inputMode="decimal"
                                    value={form.descuento}
                                    onChange={(e) => form.setDescuento(sanitizeDecimal(e.target.value))}
                                />
                            </Field>
                            <Field label="Medio de pago" required>
                                <Select
                                    value={form.medioPago === "" ? "" : String(form.medioPago)}
                                    onChange={(e) => form.setMedioPago(e.target.value === "" ? "" : Number(e.target.value))}
                                    options={form.mediosPago.map((m) => ({ value: String(m.id), label: m.nombre }))}
                                    placeholder="Seleccioná un medio de pago"
                                />
                            </Field>
                        </div>

                        {form.tipoVenta === "consignacion" ? (
                            <Field label="Fecha de venta" required style={{ marginTop: "var(--space-4)", maxWidth: 220 }}>
                                <Input type="date" value={form.fechaVenta} onChange={(e) => form.setFechaVenta(e.target.value)} />
                            </Field>
                        ) : null}

                        <div style={{ marginTop: "var(--space-5)" }}>
                            <SeleccionLibrosField
                                librosDisponibles={form.librosDisponibles}
                                seleccionados={form.seleccionados}
                                onAgregar={form.agregarLibro}
                                onActualizarCantidad={form.actualizarCantidadLibro}
                                onQuitar={form.quitarLibro}
                                disabled={form.tipoVenta === "consignacion" && form.clienteId === ""}
                                placeholder={form.tipoVenta === "consignacion" && form.clienteId === "" ? "Seleccioná un cliente" : "Seleccioná un libro"}
                                hint={
                                    form.tipoVenta === "firme" ? (
                                        <>El stock sale del depósito principal («{form.depositoPrincipal}»).</>
                                    ) : undefined
                                }
                                descuento={descuentoPct}
                                totalNota={notaComision}
                            />
                        </div>

                        <Button style={{ marginTop: "var(--space-5)" }} onClick={handleSubmit} loading={form.submitting}>
                            Registrar venta
                        </Button>
                    </>
                ) : null}
            </Card>
        </div>
    );
}
