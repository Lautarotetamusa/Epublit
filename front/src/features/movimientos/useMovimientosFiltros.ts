import { useState } from "react";
import type { TipoMovimiento } from "../../api/deposito";

export type MovimientoFiltrosState = {
    tipo: TipoMovimiento | "";
    depositoId: number | "";
    clienteId: number | "";
    desde: string;
    hasta: string;
};

const filtrosVacios: MovimientoFiltrosState = { tipo: "", depositoId: "", clienteId: "", desde: "", hasta: "" };

// Filtros del historial de movimientos. A diferencia de ventas (que filtra en
// el cliente, ver `useVentasFiltros`), acá viajan al backend como query params
// porque el listado pagina server-side (ver `useMovimientos`).
export function useMovimientosFiltros() {
    const [filtros, setFiltros] = useState<MovimientoFiltrosState>(filtrosVacios);

    const hayFiltrosActivos = Object.values(filtros).some((valor) => valor !== "");

    return {
        filtros,
        setTipo: (tipo: MovimientoFiltrosState["tipo"]) => setFiltros((actual) => ({ ...actual, tipo })),
        setDepositoId: (depositoId: MovimientoFiltrosState["depositoId"]) =>
            setFiltros((actual) => ({ ...actual, depositoId })),
        setClienteId: (clienteId: MovimientoFiltrosState["clienteId"]) =>
            setFiltros((actual) => ({ ...actual, clienteId })),
        setDesde: (desde: string) => setFiltros((actual) => ({ ...actual, desde })),
        setHasta: (hasta: string) => setFiltros((actual) => ({ ...actual, hasta })),
        limpiar: () => setFiltros(filtrosVacios),
        hayFiltrosActivos
    };
}
