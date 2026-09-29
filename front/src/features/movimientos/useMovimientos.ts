import { useCallback, useEffect, useState } from "react";
import { listMovimientos } from "../../api/deposito";
import type { Movimiento } from "../../api/deposito";

// Mismo tamaño de página que el resto de los listados paginados del cliente
// (ver useClientPagination / useLibros).
const PAGE_SIZE = 10;

// Historial de movimientos del usuario, del más reciente al más antiguo. La
// paginación la resuelve el servidor (`GET /movimiento/?pagina=&porPagina=`):
// el backend devuelve sólo la página pedida, con total y totalPaginas.
export function useMovimientos() {
    const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
    const [total, setTotal] = useState(0);
    const [totalPaginas, setTotalPaginas] = useState(1);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);

    const cargarPagina = useCallback(async (pagina: number) => {
        setLoading(true);
        try {
            const response = await listMovimientos({ pagina, porPagina: PAGE_SIZE });
            setMovimientos(response.data.movimientos);
            setTotal(response.data.total);
            setTotalPaginas(Math.max(1, response.data.totalPaginas));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        cargarPagina(page);
    }, [cargarPagina, page]);

    // Después de registrar un movimiento hay que volver a la primera página (el
    // más nuevo está ahí). Si ya estamos en la 1 el cambio de estado no dispara
    // el efecto, así que se relee a mano.
    const refetch = useCallback(() => {
        if (page === 1) return cargarPagina(1);
        setPage(1);
    }, [page, cargarPagina]);

    return { movimientos, total, totalPaginas, page, setPage, loading, refetch };
}
