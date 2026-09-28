import { Button, Combobox, Field, Input, Select } from "../../design-system";
import type { Cliente } from "../../api/cliente";
import type { MedioPago } from "../../api/operaciones";
import type { VentasFiltrosState } from "./useVentasFiltros";

const tipoVentaOptions = [
    { value: "venta", label: "En firme" },
    { value: "ventaConsignacion", label: "Sobre consignado" }
];

type VentasFiltrosProps = {
    filtros: VentasFiltrosState;
    clientes: Cliente[];
    mediosPago: MedioPago[];
    onClienteChange: (id: VentasFiltrosState["clienteId"]) => void;
    onTipoChange: (tipo: VentasFiltrosState["tipo"]) => void;
    onMedioPagoChange: (medio: VentasFiltrosState["medioPago"]) => void;
    onDesdeChange: (fecha: string) => void;
    onHastaChange: (fecha: string) => void;
    onLimpiar: () => void;
    hayFiltrosActivos: boolean;
};

// Barra de filtros de `VentasPage`: Combobox para cliente (lista larga,
// buscable), Select para tipo de venta y medio de pago (sets chicos y
// cerrados) e Input date para el rango de fechas — mismo criterio de
// componentes que ya usa `NuevaVentaPage`/`ConsignacionesPage`.
export function VentasFiltros({
    filtros,
    clientes,
    mediosPago,
    onClienteChange,
    onTipoChange,
    onMedioPagoChange,
    onDesdeChange,
    onHastaChange,
    onLimpiar,
    hayFiltrosActivos
}: VentasFiltrosProps) {
    return (
        <div style={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(140px, 1fr))", gap: "var(--space-3)" }}>
                <Field label="Cliente">
                    <Combobox
                        value={filtros.clienteId === "" ? "" : String(filtros.clienteId)}
                        onChange={(value) => onClienteChange(value === "" ? "" : Number(value))}
                        options={clientes.map((c) => ({ value: String(c.id), label: c.nombre }))}
                        placeholder="Todos los clientes"
                        emptyMessage="No se encontraron clientes"
                    />
                </Field>
                <Field label="Tipo de venta">
                    <Select
                        value={filtros.tipo}
                        onChange={(e) => onTipoChange(e.target.value as VentasFiltrosState["tipo"])}
                        options={tipoVentaOptions}
                        placeholder="Todos los tipos"
                    />
                </Field>
                <Field label="Medio de pago">
                    <Select
                        value={filtros.medioPago}
                        onChange={(e) => onMedioPagoChange(e.target.value as VentasFiltrosState["medioPago"])}
                        options={mediosPago.map((medio) => ({ value: medio, label: medio[0].toUpperCase() + medio.slice(1) }))}
                        placeholder="Todos los medios"
                    />
                </Field>
                <Field label="Desde">
                    <Input type="date" value={filtros.desde} onChange={(e) => onDesdeChange(e.target.value)} />
                </Field>
                <Field label="Hasta">
                    <Input type="date" value={filtros.hasta} onChange={(e) => onHastaChange(e.target.value)} />
                </Field>
            </div>
            {hayFiltrosActivos ? (
                <div>
                    <Button variant="ghost" size="sm" iconStart="x" onClick={onLimpiar}>
                        Limpiar filtros
                    </Button>
                </div>
            ) : null}
        </div>
    );
}
