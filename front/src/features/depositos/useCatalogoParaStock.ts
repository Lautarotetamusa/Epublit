import { useCallback, useEffect, useState } from "react";
import { listLibros } from "../../api/libro";
import type { LibroBase } from "../../api/libro";

// El catálogo completo que necesita el selector de libros de un movimiento:
// acá hace falta entero, no una página (mismo criterio que useVentaForm), y lo
// que trae `stock`/`disponible_principal` ya es el total calculado por el
// backend (ver specs/008-movimientos-deposito).
export function useCatalogoParaStock() {
    const [catalogo, setCatalogo] = useState<LibroBase[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchCatalogo = useCallback(async () => {
        setLoading(true);
        const response = await listLibros({ pageSize: 1000 });
        setCatalogo(response.items.map((libro) => ({ isbn: libro.isbn, titulo: libro.titulo, stock: libro.stock })));
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchCatalogo();
    }, [fetchCatalogo]);

    return { catalogo, loading };
}
