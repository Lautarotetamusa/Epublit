import { useMemo, useState } from "react";
import type { MedioPago, TipoOperacion, Venta } from "../../api/operaciones";

// Sólo las dos formas de venta que lista `VentasPage` (nunca consignación ni
// devolución pura, ver `Venta` en api/operaciones.ts).
export type TipoVentaFiltro = Extract<TipoOperacion, "venta" | "ventaConsignacion">;

export type VentasFiltrosState = {
    clienteId: number | "";
    tipo: TipoVentaFiltro | "";
    medioPago: MedioPago | "";
    desde: string;
    hasta: string;
};

const filtrosVacios: VentasFiltrosState = { clienteId: "", tipo: "", medioPago: "", desde: "", hasta: "" };

// Filtra en el cliente sobre el listado que ya trajo `useVentas`: hoy
// `GET /venta` no acepta query params y siempre devuelve todo (mismo
// supuesto que `useClientPagination` ya hace sobre este mismo listado). Si
// el volumen de ventas crece al punto de no poder traerlas todas de una,
// este filtro pasa a ser un candidato directo para moverse a query params
// server-side (ver "Datos necesarios" en specs/002-filtro-ventas/design.md).
export function useVentasFiltros(ventas: Venta[]) {
    const [filtros, setFiltros] = useState<VentasFiltrosState>(filtrosVacios);

    const ventasFiltradas = useMemo(
        () =>
            ventas.filter((venta) => {
                if (filtros.clienteId !== "" && venta.id_cliente !== filtros.clienteId) return false;
                if (filtros.tipo !== "" && venta.type !== filtros.tipo) return false;
                if (filtros.medioPago !== "" && venta.medio_pago !== filtros.medioPago) return false;
                const fecha = venta.fecha.slice(0, 10);
                if (filtros.desde && fecha < filtros.desde) return false;
                if (filtros.hasta && fecha > filtros.hasta) return false;
                return true;
            }),
        [ventas, filtros]
    );

    const hayFiltrosActivos = Object.values(filtros).some((valor) => valor !== "");

    return {
        filtros,
        setClienteId: (clienteId: VentasFiltrosState["clienteId"]) => setFiltros((actual) => ({ ...actual, clienteId })),
        setTipo: (tipo: VentasFiltrosState["tipo"]) => setFiltros((actual) => ({ ...actual, tipo })),
        setMedioPago: (medioPago: VentasFiltrosState["medioPago"]) => setFiltros((actual) => ({ ...actual, medioPago })),
        setDesde: (desde: string) => setFiltros((actual) => ({ ...actual, desde })),
        setHasta: (hasta: string) => setFiltros((actual) => ({ ...actual, hasta })),
        limpiar: () => setFiltros(filtrosVacios),
        hayFiltrosActivos,
        ventasFiltradas
    };
}
