import { Button, Combobox, Field, Input, Select } from "../../design-system";
import type { Cliente } from "../../api/cliente";
import type { DepositoConStock } from "../../api/deposito";
import { TIPO_MOVIMIENTO } from "./movimientoFormato";
import type { MovimientoFiltrosState } from "./useMovimientosFiltros";

// Un `Select` con los 7 tipos: la label sale de `TIPO_MOVIMIENTO`, la misma
// fuente que usa el historial para mostrarlos.
const tipoOptions = Object.entries(TIPO_MOVIMIENTO).map(([tipo, meta]) => ({ value: tipo, label: meta.label }));

type MovimientoFiltrosProps = {
    filtros: MovimientoFiltrosState;
    depositos: DepositoConStock[];
    clientes: Cliente[];
    onTipoChange: (tipo: MovimientoFiltrosState["tipo"]) => void;
    onDepositoChange: (id: MovimientoFiltrosState["depositoId"]) => void;
    onClienteChange: (id: MovimientoFiltrosState["clienteId"]) => void;
    onDesdeChange: (fecha: string) => void;
    onHastaChange: (fecha: string) => void;
    onLimpiar: () => void;
    hayFiltrosActivos: boolean;
};

// Barra de filtros de `MovimientosPage`: Select para el tipo (set chico y
// cerrado), Combobox para depósito y cliente (listas buscables) e Input date
// para el rango. Misma disposición que `VentasFiltros`.
export function MovimientoFiltros({
    filtros,
    depositos,
    clientes,
    onTipoChange,
    onDepositoChange,
    onClienteChange,
    onDesdeChange,
    onHastaChange,
    onLimpiar,
    hayFiltrosActivos
}: MovimientoFiltrosProps) {
    return (
        <div style={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(140px, 1fr))", gap: "var(--space-3)" }}>
                <Field label="Tipo de movimiento">
                    <Select
                        value={filtros.tipo}
                        onChange={(e) => onTipoChange(e.target.value as MovimientoFiltrosState["tipo"])}
                        options={tipoOptions}
                        placeholder="Todos los tipos"
                    />
                </Field>
                <Field label="Depósito">
                    <Combobox
                        value={filtros.depositoId === "" ? "" : String(filtros.depositoId)}
                        onChange={(value) => onDepositoChange(value === "" ? "" : Number(value))}
                        options={depositos.map((d) => ({ value: String(d.id), label: d.nombre }))}
                        placeholder="Todos los depósitos"
                        emptyMessage="No se encontraron depósitos"
                    />
                </Field>
                <Field label="Cliente">
                    <Combobox
                        value={filtros.clienteId === "" ? "" : String(filtros.clienteId)}
                        onChange={(value) => onClienteChange(value === "" ? "" : Number(value))}
                        options={clientes.map((c) => ({ value: String(c.id), label: c.nombre }))}
                        placeholder="Todos los clientes"
                        emptyMessage="No se encontraron clientes"
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
