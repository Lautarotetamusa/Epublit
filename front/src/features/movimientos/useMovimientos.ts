import { useCallback, useEffect, useState } from "react";
import { listMovimientos } from "../../api/deposito";
import type { ListMovimientosParams, Movimiento } from "../../api/deposito";
import type { MovimientoFiltrosState } from "./useMovimientosFiltros";

// Mismo tamaño de página que el resto de los listados paginados del cliente
// (ver useClientPagination / useLibros).
const PAGE_SIZE = 10;

// Los filtros vacíos no viajan: el backend recibe sólo los que están activos.
function aQuery(filtros: MovimientoFiltrosState): ListMovimientosParams {
    return {
        tipo: filtros.tipo === "" ? undefined : filtros.tipo,
        deposito: filtros.depositoId === "" ? undefined : filtros.depositoId,
        cliente: filtros.clienteId === "" ? undefined : filtros.clienteId,
        desde: filtros.desde === "" ? undefined : filtros.desde,
        hasta: filtros.hasta === "" ? undefined : filtros.hasta
    };
}

// Historial de movimientos del usuario, del más reciente al más antiguo. La
// paginación y los filtros los resuelve el servidor (`GET /movimiento/?pagina=&
// porPagina=&tipo=&deposito=&cliente=&desde=&hasta=`): el backend devuelve sólo
// la página pedida, con total y totalPaginas.
export function useMovimientos(filtros: MovimientoFiltrosState) {
    const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
    const [total, setTotal] = useState(0);
    const [totalPaginas, setTotalPaginas] = useState(1);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);

    // `page` sale de la misma carga: así paginar no depende de un efecto que
    // vuelva a pedir la página, y la barra de paginación siempre refleja la
    // última página efectivamente traída.
    const cargarPagina = useCallback(
        async (pagina: number) => {
            setLoading(true);
            try {
                const response = await listMovimientos({ pagina, porPagina: PAGE_SIZE, ...aQuery(filtros) });
                setMovimientos(response.data.movimientos);
                setTotal(response.data.total);
                setTotalPaginas(Math.max(1, response.data.totalPaginas));
                setPage(pagina);
            } finally {
                setLoading(false);
            }
        },
        [filtros]
    );

    // Carga inicial y recarga al cambiar los filtros: `cargarPagina` cambia de
    // identidad con ellos. Siempre se pide la página 1, porque la actual puede
    // quedar fuera del nuevo total.
    useEffect(() => {
        cargarPagina(1);
    }, [cargarPagina]);

    // Después de registrar un movimiento hay que volver a la primera página (el
    // más nuevo está ahí), que es lo mismo que pedir la página 1.
    const refetch = useCallback(() => cargarPagina(1), [cargarPagina]);

    return { movimientos, total, totalPaginas, page, setPage: cargarPagina, loading, refetch };
}
