import { useCallback, useEffect, useState } from "react";
import { listLibros } from "../../api/libro";
import type { Libro } from "../../api/libro";
import type { Pagination } from "../../api/client";

const PAGE_SIZE = 10;

// `GET /libro` sí pagina de verdad server-side (a diferencia de
// cliente/venta/consignacion, ver back/src/modules/libro/libro.repository.ts#findAllPaginated).
export function useLibros() {
    const [libros, setLibros] = useState<Libro[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [page, setPage] = useState(1);
    const [titulo, setTitulo] = useState("");
    const [loading, setLoading] = useState(true);

    const fetchLibros = useCallback(async () => {
        setLoading(true);
        const response = await listLibros({ page, pageSize: PAGE_SIZE, titulo: titulo || undefined });
        setLibros(response.items);
        setPagination(response.pagination);
        setLoading(false);
    }, [page, titulo]);

    useEffect(() => {
        fetchLibros();
    }, [fetchLibros]);

    useEffect(() => {
        setPage(1);
    }, [titulo]);

    return { libros, pagination, page, setPage, titulo, setTitulo, loading };
}
