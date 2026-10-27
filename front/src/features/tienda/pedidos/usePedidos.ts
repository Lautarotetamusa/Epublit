import { useCallback, useEffect, useRef, useState } from "react";
import { listPedidos } from "../../../api/tienda";
import type { ConteosPedidos, ListPedidosResponse, PedidoResumen } from "../../../api/tienda";
import { getErrorMessage } from "../../../lib/errors";
import type { PedidosFiltrosState } from "./usePedidosFiltros";

export const PEDIDOS_POR_PAGINA = 20;

const CONTEO_VACIO: ConteosPedidos = {
    todos: 0,
    pendiente_pago: 0,
    pagado: 0,
    aceptado: 0,
    enviado: 0,
    entregado: 0,
    rechazado: 0,
    cancelado: 0
};

// Listado server-side: el backend aplica los filtros, calcula los conteos de
// las pestañas sobre el recorte y pagina. El debounce evita una request por
// tecla al buscar y el `requestId` descarta respuestas viejas que lleguen
// fuera de orden.
export function usePedidos(filtros: PedidosFiltrosState, pagina: number) {
    const [data, setData] = useState<ListPedidosResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);
    const requestId = useRef(0);

    useEffect(() => {
        const id = ++requestId.current;
        setLoading(true);
        setError(null);

        const timer = window.setTimeout(async () => {
            try {
                const response = await listPedidos({
                    estado: filtros.estado,
                    buscar: filtros.busqueda.trim() || undefined,
                    desde: filtros.desde || undefined,
                    hasta: filtros.hasta || undefined,
                    entrega: filtros.entrega || undefined,
                    pagina,
                    porPagina: PEDIDOS_POR_PAGINA
                });

                if (id === requestId.current) setData(response);
            } catch (err) {
                if (id === requestId.current) {
                    setData(null);
                    setError(getErrorMessage(err));
                }
            } finally {
                if (id === requestId.current) setLoading(false);
            }
        }, 250);

        return () => {
            window.clearTimeout(timer);
            requestId.current += 1;
        };
    }, [filtros.estado, filtros.busqueda, filtros.desde, filtros.hasta, filtros.entrega, pagina, reloadKey]);

    const refetch = useCallback(() => setReloadKey((actual) => actual + 1), []);

    return {
        pedidos: data?.pedidos ?? ([] as PedidoResumen[]),
        conteos: data?.conteos ?? CONTEO_VACIO,
        total: data?.total ?? 0,
        pagina: data?.pagina ?? pagina,
        porPagina: data?.porPagina ?? PEDIDOS_POR_PAGINA,
        loading,
        error,
        refetch
    };
}
