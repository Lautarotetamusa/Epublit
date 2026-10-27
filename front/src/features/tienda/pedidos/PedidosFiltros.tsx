import { Button, Field, Input, Select, Tabs } from "../../../design-system";
import type { ConteosPedidos } from "../../../api/tienda";
import type { PedidosFiltrosState } from "./usePedidosFiltros";
import { ESTADOS_PEDIDO, ESTADO_PEDIDO_LABEL } from "./tipos";

type PedidosFiltrosProps = {
    filtros: PedidosFiltrosState;
    conteos: ConteosPedidos;
    onEstadoChange: (estado: PedidosFiltrosState["estado"]) => void;
    onBusquedaChange: (busqueda: string) => void;
    onDesdeChange: (desde: string) => void;
    onHastaChange: (hasta: string) => void;
    onEntregaChange: (entrega: PedidosFiltrosState["entrega"]) => void;
    onLimpiar: () => void;
    hayFiltrosActivos: boolean;
};

// Dos niveles de filtro, con jerarquía distinta: las pestañas responden "en
// qué etapa está cada pedido" (con el conteo a la vista) y la barra de abajo
// recorta por texto, fecha o forma de entrega. Separarlos evita una fila de
// seis selects equivalentes donde el estado se pierde entre los demás.
export function PedidosFiltros({
    filtros,
    conteos,
    onEstadoChange,
    onBusquedaChange,
    onDesdeChange,
    onHastaChange,
    onEntregaChange,
    onLimpiar,
    hayFiltrosActivos
}: PedidosFiltrosProps) {
    const tabs = [
        { value: "todos", label: "Todos", count: conteos.todos },
        ...ESTADOS_PEDIDO.map((estado) => ({
            value: estado,
            label: ESTADO_PEDIDO_LABEL[estado],
            count: conteos[estado]
        }))
    ];

    return (
        <>
            <div style={{ padding: "var(--space-4) var(--space-5) 0" }}>
                <div style={{ overflowX: "auto" }}>
                    <Tabs
                        items={tabs}
                        value={filtros.estado}
                        onChange={(value) => onEstadoChange(value as PedidosFiltrosState["estado"])}
                    />
                </div>
            </div>
            <div
                style={{
                    padding: "var(--space-4) var(--space-5)",
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "flex-end",
                    gap: "var(--space-3)"
                }}
            >
                <Field label="Buscar" style={{ flex: "1 1 260px", minWidth: 220 }}>
                    <Input
                        iconStart="search"
                        placeholder="Código, comprador, email o teléfono"
                        value={filtros.busqueda}
                        onChange={(e) => onBusquedaChange(e.target.value)}
                    />
                </Field>
                <Field label="Desde" style={{ flex: "0 1 150px" }}>
                    <Input type="date" value={filtros.desde} onChange={(e) => onDesdeChange(e.target.value)} />
                </Field>
                <Field label="Hasta" style={{ flex: "0 1 150px" }}>
                    <Input type="date" value={filtros.hasta} onChange={(e) => onHastaChange(e.target.value)} />
                </Field>
                <Field label="Entrega" style={{ flex: "0 1 170px" }}>
                    <Select
                        value={filtros.entrega}
                        placeholder="Todas"
                        onChange={(e) => onEntregaChange(e.target.value as PedidosFiltrosState["entrega"])}
                        options={[
                            { value: "envio", label: "Envío a domicilio" },
                            { value: "retiro", label: "Retiro en local" }
                        ]}
                    />
                </Field>
                {hayFiltrosActivos ? (
                    <Button variant="ghost" size="sm" iconStart="x" onClick={onLimpiar} style={{ alignSelf: "flex-end" }}>
                        Limpiar filtros
                    </Button>
                ) : null}
            </div>
        </>
    );
}
