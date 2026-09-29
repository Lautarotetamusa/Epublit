import { useCallback, useEffect, useState } from "react";
import { listLibros } from "../../api/libro";
import type { Libro } from "../../api/libro";
import type { Pagination } from "../../api/client";
import { mockTotalDeLibro } from "../depositos/depositosMock";

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
        // El stock que muestra el catálogo es el total de los depósitos (ver
        // specs/008); el backend todavía informa un stock global, así que el
        // total lo resuelve el mock de movimientos.
        setLibros(response.items.map((libro) => ({ ...libro, stock: mockTotalDeLibro(libro.isbn, libro.stock ?? 0) })));
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
